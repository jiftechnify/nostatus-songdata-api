import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

type SongData = {
  url: string;
  title?: string;
  artist?: string;
};

type SongLinkEntity = {
  title?: string;
  artistName?: string;
  apiProvider: string;
};

type SongLinkResp = {
  entityUniqueId: string;
  pageUrl: string;
  entitiesByUniqueId: Record<string, SongLinkEntity>;
};

const extractSongData = (slResp: SongLinkResp): SongData => {
  const url = slResp.pageUrl;
  const spotifyEntity = Object.values(slResp.entitiesByUniqueId).find((e) =>
    e.apiProvider === "spotify"
  );
  if (spotifyEntity !== undefined) {
    return {
      url,
      title: spotifyEntity.title,
      artist: spotifyEntity.artistName,
    };
  }

  const entity = slResp.entitiesByUniqueId[slResp.entityUniqueId];
  if (entity !== undefined) {
    return {
      url,
      title: entity.title,
      artist: entity.artistName,
    };
  }

  return { url };
};

const app = new Hono();

app.get(
  "*",
  cors({
    origin: (origin) =>
      origin.startsWith("https://nostatus") && origin.endsWith(".vercel.app") ||
        origin.includes("localhost:")
        ? origin
        : undefined,
    allowMethods: ["GET"],
  }),
);

app.get(
  "*",
  cache({
    cacheName: "cache",
  }),
);

app.get("/", async (c) => {
  const shareUrl = c.req.query("url");
  if (shareUrl === undefined) {
    throw new HTTPException(400, { message: "Bad Request" });
  }
  const userCountry = c.req.query("country") ?? "US";

  const url = new URL("https://api.song.link/v1-alpha.1/links");
  const params = new URLSearchParams();
  params.set("url", shareUrl);
  params.set("userCountry", userCountry);
  params.set("songIfSingle", "true");
  url.search = params.toString();

  console.log("forwarding request to:", url.toString());

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new HTTPException(resp.status, { message: resp.statusText });
  }

  const slResp = (await resp.json()) as SongLinkResp;

  const songData = extractSongData(slResp);
  console.log("song data for %s: %O", shareUrl, songData);

  return c.json(songData);
});

export default app;
