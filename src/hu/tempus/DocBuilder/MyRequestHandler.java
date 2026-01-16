/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package hu.tempus.DocBuilder;

import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.LinkedHashMap;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.JsonArray;

import hu.tempus.HtmlGui.Config;
import hu.tempus.HtmlGui.IOUtils;
import hu.tempus.HtmlGui.RequestHandler;

/**
 *
 * @author TeMPuS
 */
public class MyRequestHandler extends RequestHandler {

	protected final String mTemplateRoot;

	public MyRequestHandler(Config config) {
		super(config);
		mTemplateRoot = config.getValue("templates", "templates");
	}

	@Override
	public void onStart() {

	}

	@Override
	protected boolean process(RequestWrapper req) throws IOException {

		// if (req.path.equals("/changelog")) {
		// Map<String, String> p = new HashMap<>();
		// p.put("auth", PREFS.getValue("auth"));
		// IOUtils.ReadFile f = IOUtils.fetchURL(UPLINK.replace("/kiosk", "/changelog"),
		// p);

		// Headers h = req.request.getResponseHeaders();
		// h.add("Content-Type", "text/plain;charset=utf-8");
		// req.request.sendResponseHeaders(200, 0);
		// IOUtils.redirect(f.is, req.getOutputStream());
		// return true;
		// }

		String[] path = req.path.substring(1).split("/");

		// static files
		if (path.length > 1 && IOUtils.isFile(mRoot + req.path)) {
			return false;
		}

		Map<String, Object> resp = new LinkedHashMap<>();

		// file handling
		if (path[0].matches("(open|save)")) {
			try {
				String docId = req.getParameter("id", "");
				DocEditor editor;
				if (path[0].equals("open") && docId.isEmpty()) {
					editor = DocEditor.open(req.getParameter("last", ""));
					if (editor == null) {
						resp.put("success", true);
						return req.sendData(resp);
					}
				} else {
					editor = DocEditor.load(docId, "1".equals(req.getParameter("reload")));
				}
				if (path[0].equals("save")) {
					editor.setChunks(new Gson().fromJson(new InputStreamReader(req.request.getRequestBody()), JsonArray.class));
					editor.save("1".equals(req.getParameter("create")));
					resp.put("success", true);
					return req.sendData(resp);
				}
				resp.put("success", true);
				resp.put("id", editor.getId());
				resp.put("chunks",  editor.getChunks());
				resp.put("js", editor.getJS());
				resp.put("css", editor.getCSS());
				return req.sendData(resp);
			} catch (Exception e) {
				resp.put("error", e.getMessage());
				return req.sendData(resp);
			}
		}

		if (path[0].equals(mTemplateRoot)) {
			return req.sendData(new File(req.path.substring(1)));
		}

		// Admin Handling

		// Start upgrade
		// if (req.path.equals("/upgrade")) {
		// if (!HAS_UPGRADE) {
		// return req.sendData("0 OK");
		// }
		// String fn = mConfig.getValue("JAR");
		// if (fn != null) {
		// try {
		// Map<String, String> p = new HashMap<>();
		// p.put("auth", PREFS.getValue("auth"));
		// IOUtils.ReadFile f = IOUtils.fetchURL(UPLINK.replace("/kiosk", "/download"),
		// p);
		// if (f.is != null) {
		// fn = fn.replace(".jar", ".new.jar");
		// IOUtils.redirect(f, new FileOutputStream(fn));
		// } else {
		// fn = null;
		// }
		// } catch (Exception e) {
		// fn = null;
		// Logger.error(e);
		// }

		// }
		// if (fn != null) {
		// req.sendData("0 OK");
		// Runtime.getRuntime().exec("javaw -jar \"" + fn + "\"");
		// System.exit(0);
		// return true;
		// } else {
		// return req.sendError(400, "Please <a href='" + UPLINK.replace("/kiosk",
		// "/download") + "'>download</a> the new version manually!");
		// }
		// }

		return super.process(req);
	}

}
