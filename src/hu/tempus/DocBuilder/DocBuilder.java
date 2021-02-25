/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package hu.tempus.DocBuilder;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;

import javax.swing.UIManager;

import hu.tempus.HtmlGui.Config;
import hu.tempus.HtmlGui.GlobalConfig;
import hu.tempus.HtmlGui.IOUtils;
import hu.tempus.HtmlGui.TimedDialog;
import hu.tempus.HtmlGui.WebServer;

/**
 *
 * @author TeMPuS
 */
public class DocBuilder {

	/**
	 * @param args the command line arguments
	 */
	public static void main(String[] args) {
		PrintStream ps;

		try {
			UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());

			Config config = new Config().read("config.json");

			File jarpath = new File(DocBuilder.class.getProtectionDomain().getCodeSource().getLocation().getPath());
			String jardir = jarpath.getParent();

			GlobalConfig.load(config);

			config.setValue("storepass", "mBeYgMRUiSqVaTiB");
			config.setValue("keypass", "T3nyFF6RHsPoqunV");

			for (String arg : args) {
				String[] a = arg.split("=");
				config.setValue(a[0], a.length > 1 ? a[1] : "1");
			}

			boolean stop = config.getValue("stop") != null;
			if (!IOUtils.globalMutex(jardir + "/DocBuilder.pid", !stop) || stop) {
				System.exit(0);
			}

			String error = "";

			File f = new File(jardir + "/DocBuilder.log");
			if (f.exists() && f.length() > 0) {
				error = IOUtils.read(new IOUtils.ReadFile(f), 50).trim();
				error = error.replaceAll("\n", "\\\\n");
				error = error.replaceAll("\r", "\\\\r");
				error = error.replaceAll("\t", "\\\\t");
			}
			ps = new PrintStream(new FileOutputStream(f));
			System.setErr(ps);
			System.setOut(ps);

			// Add Templates

			try {
				for (File tpl : IOUtils.getFiles(config.getValue("templates", "templates"), "\\.json$")) {
					DocEditor.addTemplate(tpl);
				}
			} catch (Exception e) {
				e.printStackTrace(System.err);
			}

			MyRequestHandler handler = new MyRequestHandler(config);
			WebServer server = new WebServer(config, handler);

			server.setBrowser("");

			server.init();
			server.start();
		} catch (Exception e) {
			String es = e.getMessage();
			for (StackTraceElement es1 : e.getStackTrace()) {
				if (!es.isEmpty()) {
					es += "\n";
				}
				es += es1.toString();
			}
			TimedDialog.create(es, 30, false);
			System.exit(1);
		}
	}

}
