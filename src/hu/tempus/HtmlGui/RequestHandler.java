package hu.tempus.HtmlGui;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLDecoder;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;

import javax.json.JsonStructure;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

public class RequestHandler implements HttpHandler {

	protected final Config mConfig;
	protected final String mRoot;
	protected WebServer mServer;
	private final String origin;
	private final Map<String, Long> instances = new HashMap<>();
	private static final SimpleDateFormat HDATE = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US);

	public RequestHandler(Config config) {
		mConfig = config;
		mRoot = config.getValue("root", "www");
		origin = config.getValue("origin", "");
		new Timer().scheduleAtFixedRate(new InstanceChecker(), 1000, 1000);
	}

	public RequestHandler setServer(WebServer server) {
		mServer = server;
		return this;
	}

	public void onStart() {
	}

	@Override
	public void handle(HttpExchange request) throws IOException {
		RequestWrapper req = new RequestWrapper(request);

		// allow ajax requests from anywhere
		if (!origin.isEmpty()) {
			req.addHeader("Access-Control-Allow-Origin", origin);
		}

		try {
			if (process(req)) {
				return;
			}
		} catch (Exception e) {
			Logger.error(e);
		}

		// Static file handling
		if (!req.path.endsWith("/") && IOUtils.isDirectory(mRoot + req.path)) {
			req.redirect(req.path + "/");
			return;
		}
		if (req.sendData(new File(mRoot + req.path))) {
			return;
		}

		// Return 404
		Logger.debug("404 '" + req.path + "' Not Found");
		req.sendError(404, "404 '" + req.path + "' Not Found");
	}

	protected boolean process(RequestWrapper req) throws IOException {
		// Shutdown handling
		if (req.path.equals("/add-session")) {
			String id = req.getParameter("id");
			if (id != null) {
				instances.put(id, null);
			}
			return req.sendData("0 OK");
		}
		if (req.path.equals("/del-session")) {
			String id = req.getParameter("id");
			if (id != null) {
				instances.put(id, new Date().getTime() / 1000);
			}
			return req.sendData("0 OK");
		}
		if (req.path.equals("/exit")) {
			req.sendData("0 OK");
			System.exit(0);
			return true;
		}

		// Is it running?
		if (req.path.equals("/test")) {
			return req.sendData("0 OK");
		}

		if (req.path.equals("/proxy")) {
			String address = req.getParameter("u");
			if (address == null) {
				return req.sendError(400, "400 Missing 'u' parameter");
			}

			try {
				URL url = new URL(address);
				URLConnection conn = url.openConnection();
				Headers h = req.request.getRequestHeaders();
				conn.setRequestProperty("User-Agent", h.getFirst("User-Agent"));
				if ("POST".equals(req.request.getRequestMethod())) {
					conn.setRequestProperty("Content-Type", h.getFirst("Content-Type"));
					conn.setRequestProperty("Content-Length", h.getFirst("Content-Length"));
					conn.setDoOutput(true);
					IOUtils.redirect(req.request.getRequestBody(), conn.getOutputStream());
				} else {
					conn.connect();
				}

				String type = conn.getContentType();
				if (type != null) {
					req.addHeader("Content-Type", type);
				}

				Long len = conn.getContentLengthLong();
				req.request.sendResponseHeaders(200, len == -1 ? 0 : len);

				IOUtils.redirect(conn.getInputStream(), req.request.getResponseBody());
				return true;

			} catch (MalformedURLException e) {
				Logger.error("Invalid url: " + address);
			} catch (IOException e) {
				Logger.error("Could not fetch url: " + address);
			}

			return req.sendError(500, "500 Exception");
		}

		if (req.path.equals("/error")) {
			String error = IOUtils.read(req.request.getRequestBody());
			Logger.error(error);
			return req.sendData("0 OK");
		}

		return false;
	}

	protected static class RequestWrapper {

		public HttpExchange request;
		public String path;
		public Map<String, List<String>> parameters;

		public boolean dontClose = false;

		RequestWrapper(HttpExchange request) {
			this.request = request;
			path = request.getRequestURI().getPath().replaceAll("\\\\", "/").replaceAll("\\.\\./", "");
			if (path.endsWith("/")) {
				path += "index.html";
			}
			Logger.debug("Handling URL: " + path);

			parameters = new HashMap<>();
			String query = request.getRequestURI().getRawQuery();
			if (query != null) {
				try {
					for (String param : query.split("&")) {
						String pair[] = param.split("=");
						pair[0] = URLDecoder.decode(pair[0], "UTF-8");
						List<String> values = parameters.getOrDefault(pair[0], new ArrayList<>());
						values.add(pair.length > 1 ? URLDecoder.decode(pair[1], "UTF-8") : "");
						parameters.put(pair[0], values);
					}
				} catch (UnsupportedEncodingException e) {
					Logger.error(e);
				}
			}

			Headers h = request.getResponseHeaders();
			h.add("Access-Control-Allow-Origin", "*");
			h.add("Access-Control-Allow-Headers", "*");
			h.add("Access-Control-Allow-Methods", "GET, POST");
			h.add("Cache-Control", "no-cache");
			h.add("X-Content-Type-Options", "nosniff");
		}

		public List<String> getParameterValues(String key) {
			return parameters.get(key);
		}

		public String getParameter(String key) {
			return getParameter(key, null);
		}

		public String getParameter(String key, String def) {
			return parameters.containsKey(key) ? parameters.get(key).get(0) : def;
		}

		public Map<String, String> getParameters() {
			Map<String, String> data = new HashMap<>();
			parameters.entrySet().forEach((p) -> {
				data.put(p.getKey(), p.getValue().get(0));
			});
			return data;
		}

		public void addHeader(String key, String value) {
			request.getResponseHeaders().add(key, value);
		}

		public boolean sendHtml(String html) throws IOException {
			addHeader("Content-Type", "text/html;charset=utf-8");
			addHeader("Content-Length", Integer.toString(html.getBytes().length));
			request.sendResponseHeaders(200, html.length());
			try (OutputStream os = request.getResponseBody()) {
				os.write(html.getBytes());
			} catch (IOException e) {
				// we don't care about the client aborting the connection
			}
			return true;
		}

		public boolean sendError(int errorCode, String text) throws IOException {
			addHeader("Content-Type", "text/plain;charset=utf-8");
			addHeader("Content-Length", Integer.toString(text.getBytes().length));
			request.sendResponseHeaders(errorCode, text.length());
			try (OutputStream os = request.getResponseBody()) {
				os.write(text.getBytes());
			} catch (IOException e) {
				// we don't care about the client aborting the connection
			}
			return true;
		}

		public boolean sendData(String text) throws IOException {
			return sendError(200, text);
		}

		public boolean sendData(Object data) throws IOException {
			JsonStructure json = (JsonStructure) JsonHelper.pojoToJson(data);
			byte[] content = JsonHelper.serialize(json);
			addHeader("Content-Type", "application/json;charset=utf-8");
			request.sendResponseHeaders(200, content.length);
			try (OutputStream os = request.getResponseBody()) {
				os.write(content);
				os.close();
			} catch (IOException e) {
				// we don't care about the client aborting the connection
			}
			return true;
		}

		public boolean sendData(File file) throws IOException {
			IOUtils.ReadFile r = new IOUtils.ReadFile(file);
			if (r.isNull()) {
				r.close();
				return false;
			}

			addHeader("Accept-Ranges", "bytes");
			addHeader("Content-Type", r.contentType + ";charset=utf-8");

			int off = 0, len = r.fileSize;
			List<String> range = request.getRequestHeaders().get("Range");
			if (range != null && !range.isEmpty()) {
				String[] n = range.get(0).split("[=-]");
				if (n.length > 1) {
					off = Integer.parseInt(n[1].trim());
				}
				len = (n.length > 2 ? Integer.parseInt(n[2].trim()) + 1 : r.fileSize) - off;
				addHeader("Content-Range", "bytes " + off + "-" + (off + len - 1) + "/" + r.fileSize);
			}

			long mtime = r.modTime;
			addHeader("Last-Modified", HDATE.format(new Date(mtime)));

			String ifmod = request.getRequestHeaders().getFirst("If-Modified-Since");
			try {
				if (ifmod != null) {
					if (HDATE.parse(ifmod).getTime() >= mtime) {
						request.sendResponseHeaders(304, -1);
						request.getResponseBody().close();
						return true;
					}
				}
			} catch (Exception e) {
			}

			request.sendResponseHeaders(len < r.fileSize ? 206 : 200, len);

			try (OutputStream os = request.getResponseBody()) {
				IOUtils.redirect(r, os, off, len);
			} catch (IOException e) {
				// we don't care about the client aborting the connection
			}
			r.close();
			return true;
		}

		public OutputStream getOutputStream() {
			return new OutputStream() {
				@Override
				public void write(int i) {
					try {
						request.getResponseBody().write(i);
					} catch (IOException e) {
						// ignore
					}
				}

				@Override
				public void close() {
					if (dontClose) {
						return;
					}
					try {
						request.getResponseBody().close();
					} catch (IOException e) {
						// ignore
					}
				}

				@Override
				public void flush() {
					try {
						request.getResponseBody().flush();
					} catch (IOException e) {
						// ignore
					}
				}

			};
		}

		public boolean redirect(String url) throws IOException {
			addHeader("Location", url);
			request.sendResponseHeaders(302, 0);
			request.getResponseBody().close();
			return true;
		}

	}

	private class InstanceChecker extends TimerTask {

		@Override
		public void run() {
			if (instances.isEmpty()) {
				return;
			}
			Long expired = (new Date().getTime() / 1000) - 4;
			instances.entrySet().removeIf(entry -> entry.getValue() != null && entry.getValue() < expired);
			if (instances.isEmpty()) {
				if (TimedDialog.create("No active instances! Do you want to exit?", 10, true) != TimedDialog.NO) {
					System.exit(0);
				} else {
					try {
						mServer.startBrowser();
					} catch (Exception e) {
						Logger.error(e);
					}
				}
			}
		}
	}
}
