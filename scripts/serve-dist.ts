/** Serve the extension dist over HTTP for visual verification of the panel UI. */

const DIST = "C:/Users/i/pi-browser-agent/extension/dist";

const server = Bun.serve({
	port: 3849,
	hostname: "127.0.0.1",
	async fetch(request) {
		const url = new URL(request.url);
		let path = url.pathname;
		if (path === "/") path = "/src/sidepanel/index.html";
		const file = Bun.file(`${DIST}${path}`);
		if (await file.exists()) return new Response(file);
		return new Response("Not found", { status: 404 });
	},
});
console.log(`serving ${DIST} at http://127.0.0.1:${server.port}`);