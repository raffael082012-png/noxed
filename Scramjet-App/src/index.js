import { createServer } from "node:http"; import { Readable } from "node:stream";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// Wisp Configuration: Refer to the documentation at https://www.npmjs.com/package/@mercuryworkshop/wisp-js

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	
	dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
				else socket.end();
			});
	},
});

fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});

fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scram/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});

const backgroundVideos={video1:"https://motionbgs.com/media/9212/dream-chaser-black-and-white.960x540.mp4",video2:"https://motionbgs.com/media/10270/a-galaxy-within.960x540.mp4",video3:"https://motionbgs.com/media/9243/minecraft-overgrown-cabin.960x540.mp4",video4:"https://motionbgs.com/media/5532/sasuke.960x540.mp4",video5:"https://motionbgs.com/media/9019/naruto-endless-sky.960x540.mp4",video6:"https://motionbgs.com/media/9292/satoru-gojo-shattered-sky.960x540.mp4",video7:"https://motionbgs.com/media/8711/perfect-cell-dragon-ball-z.960x540.mp4",video8:"https://motionbgs.com/media/9251/giyu-tomioka-snow-blossoms.960x540.mp4",video9:"https://motionbgs.com/media/9440/gon-freecss-fishing-day.960x540.mp4",video10:"https://assets.mixkit.co/videos/35321/35321-720.mp4",video11:"https://assets.mixkit.co/videos/35318/35318-720.mp4",video12:"https://assets.mixkit.co/videos/31770/31770-720.mp4",video13:"https://assets.mixkit.co/videos/31497/31497-720.mp4",video14:"https://assets.mixkit.co/videos/44685/44685-720.mp4"};fastify.get("/api/background/:id",async(request,reply)=>{const source=backgroundVideos[request.params.id];if(!source)return reply.code(404).send({error:"Background not found."});try{const headers={};if(request.headers.range)headers.Range=request.headers.range;const response=await fetch(source,{headers,signal:AbortSignal.timeout(30000)});if(!response.ok&&response.status!==206)return reply.code(502).send({error:"Background video is unavailable."});reply.code(response.status);reply.header("Content-Type",response.headers.get("content-type")||"video/mp4");reply.header("Cross-Origin-Resource-Policy","same-origin");reply.header("Accept-Ranges",response.headers.get("accept-ranges")||"bytes");for(const header of ["content-length","content-range"]){const value=response.headers.get(header);if(value)reply.header(header,value);}reply.header("Cache-Control","public, max-age=3600");return reply.send(Readable.fromWeb(response.body));}catch(error){request.log.warn({err:error,id:request.params.id},"Background video proxy failed");return reply.code(502).send({error:"Background video could not be loaded."});}});fastify.post("/api/shorten", async (request, reply) => {
	let target;
	try {
		target = new URL(request.body?.url);
	} catch {
		return reply.code(400).send({ error: "Enter a valid site URL." });
	}

	if (target.protocol !== "https:" || target.hostname !== "noxed-1.onrender.com") {
		return reply.code(400).send({ error: "Only the hosted Noxveil site can be shortened." });
	}

	try {
		const endpoint = new URL("https://is.gd/create.php");
		endpoint.searchParams.set("format", "json");
		endpoint.searchParams.set("url", target.href);
		const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
		const result = await response.json();
		if (!response.ok || !result.shorturl) {
			return reply.code(502).send({
				error: result.errormessage || "The short-link service could not create a link. Try again shortly.",
			});
		}
		return { url: result.shorturl };
	} catch (error) {
		request.log.warn({ err: error }, "Link shortening failed");
		return reply.code(502).send({ error: "Could not reach the short-link service. Try again shortly." });
	}
});

fastify.setNotFoundHandler((res, reply) => {
	return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
	const address = fastify.server.address();

	// by default we are listening on 0.0.0.0 (every interface)
	// we just need to list a few
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	fastify.close();
	process.exit(0);
}

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

fastify.listen({
	port: port,
	host: "0.0.0.0",
});
