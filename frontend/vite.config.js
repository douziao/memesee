import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const devServerHost = process.env.VITE_DEV_HOST || "127.0.0.1";

const vendorChunkByPackage = new Map([
  ["axios", "http-vendor"],
  ["react", "react-vendor"],
  ["react-dom", "react-vendor"],
  ["scheduler", "react-vendor"],
]);

function packageNameFromNodeModuleId(id) {
  const normalized = id.replace(/\\/g, "/");
  const marker = "/node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0) {
    return "";
  }
  const packagePath = normalized.slice(markerIndex + marker.length);
  const parts = packagePath.split("/");
  if (parts[0]?.startsWith("@")) {
    return `${parts[0]}/${parts[1] || ""}`;
  }
  return parts[0] || "";
}

function vendorChunkForModule(id) {
  const packageName = packageNameFromNodeModuleId(id);
  if (!packageName) {
    return undefined;
  }
  if (vendorChunkByPackage.has(packageName)) {
    return vendorChunkByPackage.get(packageName);
  }
  return undefined;
}

function isIgnorableSocketError(error) {
  const code = String(error?.code || "");
  return code === "ECONNRESET" || code === "EPIPE";
}

function logSocketError(prefix, error) {
  if (!isIgnorableSocketError(error)) {
    console.error(prefix, error);
  }
}

function installProcessErrorGuards() {
  if (globalThis.__memeseeViteSocketGuardsInstalled) {
    return;
  }
  globalThis.__memeseeViteSocketGuardsInstalled = true;

  process.on("uncaughtException", (error) => {
    if (isIgnorableSocketError(error)) {
      console.warn(`[vite] ignored transient socket error: ${error.code}`);
      return;
    }
    console.error("[vite] uncaught exception", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    if (isIgnorableSocketError(reason)) {
      console.warn(`[vite] ignored transient socket rejection: ${reason.code}`);
      return;
    }
    console.error("[vite] unhandled rejection", reason);
  });
}

function stableSocketPlugin() {
  installProcessErrorGuards();
  return {
    name: "memesee-stable-sockets",
    configureServer(server) {
      server.httpServer?.on("connection", (socket) => {
        socket.on("error", (error) => {
          logSocketError("[vite socket]", error);
        });
      });

      server.httpServer?.on("clientError", (error, socket) => {
        logSocketError("[vite clientError]", error);
        if (socket?.writable) {
          socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), stableSocketPlugin()],
  server: {
    host: devServerHost,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.on("error", (error) => {
              logSocketError("[vite proxyReq]", error);
            });
          });

          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.socket?.on("error", (error) => {
              logSocketError("[vite proxyRes]", error);
            });
          });

          proxy.on("econnreset", (error, _req, res) => {
            logSocketError("[vite proxy econnreset]", error);
            if (!res || res.headersSent) {
              return;
            }
            res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ message: "代理连接已重置。" }));
          });

          proxy.on("error", (error, _req, res) => {
            logSocketError("[vite proxy]", error);
            if (!res || res.headersSent) {
              return;
            }
            res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ message: "代理请求失败。" }));
          });
        },
      },
    },
  },
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return vendorChunkForModule(id);
        },
      },
    },
  },
});
