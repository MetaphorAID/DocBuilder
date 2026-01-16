/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package hu.tempus.HtmlGui;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.OutputStream;
import java.util.Date;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import com.google.gson.Gson;
import com.google.gson.JsonElement;

/**
 *
 * @author TeMPuS
 */
public class FileCache {

	public static final String WORKDIR;

	static {
		String dir = System.getProperty("user.dir");
		if (dir != null) {
			WORKDIR = dir + "/.cache/";
		} else {
			WORKDIR = null;
		}
	}

	public static File getFile(String name) {
		if (WORKDIR == null) {
			return null;
		}
		File f = new File(WORKDIR + name);
		if (!f.exists()) {
			return null;
		}
		return f;
	}

	public static InputStream getStream(String name) {
		File f = getFile(name);
		if (f == null) {
			return null;
		}
		return new IOUtils.ReadFile(f);
	}

	private static OutputStream addStream(String name, boolean append) throws FileNotFoundException {
		if (WORKDIR == null) {
			return null;
		}
		File f = new File(WORKDIR + name);
		File d = f.getParentFile();
		if (d != null && !d.exists()) {
			d.mkdirs();
		}
		return new FileOutputStream(f, append);
	}

	public static String getString(String name) {
		try (
				InputStream is = getStream(name);) {
			if (is == null) {
				return null;
			}
			return IOUtils.read(is);
		} catch (IOException e) {
			Logger.error(e);
		}
		return null;
	}

	public static JsonElement getJson(String name) {
		try (
				InputStream is = getStream(name);) {
			return new Gson().fromJson(new InputStreamReader(is), JsonElement.class);
		} catch (IOException e) {
			Logger.error(e);
		}
		return null;
	}

	public static Object getObject(String name) {
		try (InputStream is = getStream(name)) {
			if (is == null) {
				return null;
			}
			ObjectInputStream in = new ObjectInputStream(is);
			return in.readObject();
		} catch (ClassNotFoundException | IOException e) {
			Logger.error(e);
		}
		return null;
	}

	public static void add(String name, Object object) throws IOException {
		OutputStream os = addStream(name, false);
		if (object instanceof String) {
			os.write(((String) object).getBytes("UTF-8"));
		} else if (object instanceof InputStream) {
			IOUtils.redirect((InputStream) object, os);
		} else if (object instanceof JsonElement) {
			os.write(new Gson().toJson(object).getBytes("UTF-8"));
		} else if (object instanceof IOUtils.ReadFile) {
			IOUtils.redirect((IOUtils.ReadFile) object, os);
		} else {
			ObjectOutputStream out = new ObjectOutputStream(os);
			out.writeObject(object);
		}
	}

	public static void addZip(String dir, InputStream is, boolean flat) throws IOException {
		add(dir + ".zip", is);
		File d = new File(WORKDIR + dir);
		IOUtils.delete(d);
		ZipInputStream zipIn = new ZipInputStream(getStream(dir + ".zip"));
		ZipEntry entry;
		while ((entry = zipIn.getNextEntry()) != null) {
			if (entry.isDirectory()) {
				continue;
			}
			add(dir + File.separator + (flat ? new File(entry.getName()).getName() : entry.getName()), zipIn);
			zipIn.closeEntry();
		}
	}

	public static void append(String name, String text) throws IOException {
		addStream(name, true).write(text.getBytes("UTF-8"));
	}

	public static void remove(String name) {
		remove(new File(WORKDIR + name));
	}

	private static void remove(File f) {
		if (f.isDirectory()) {
			for (File f1 : f.listFiles()) {
				remove(f1);
			}
			f.delete();
		} else {
			f.delete();
		}
	}

	public static void merge(String into, String from) throws IOException {
		IOUtils.redirect(getStream(from), addStream(into, true));
		add(from, "");
	}

	public static boolean isNewer(String name, Date date) {
		File f = getFile(name);
		if (f == null) {
			return false;
		}
		return f.lastModified() > date.getTime();
	}

	public static long getModified(String name) {
		File f = getFile(name);
		if (f == null) {
			return 0;
		}
		return f.lastModified();
	}
}
