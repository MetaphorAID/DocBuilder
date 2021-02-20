package hu.tempus.HtmlGui;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.io.UnsupportedEncodingException;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.math.BigInteger;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;
import java.util.zip.GZIPOutputStream;

public class IOUtils {

	private static final Map<String, String> MIME_TYPES = new HashMap<>();

	static {
		MIME_TYPES.put("types", "text/plain");
		MIME_TYPES.put("json", "application/json");
		MIME_TYPES.put("js", "text/javascript");
		MIME_TYPES.put("css", "text/css");
		MIME_TYPES.put("MF", "text/plain"); // manifest
		ReadFile r = new ReadFile(new File("mime.types"));
		if (!r.isNull()) {
			try {
				String[] lines = read(r).split("[\r\n]+");
				for (String l : lines) {
					if (l.charAt(0) == '#') {
						continue;
					}
					String[] d1 = l.split("\t+");
					if (d1.length < 2) {
						continue;
					}
					String[] d2 = d1[1].split(" ");
					for (String d21 : d2) {
						MIME_TYPES.put(d21, d1[0]);
					}
				}
			} catch (IOException e) {
				e.printStackTrace(System.err);
			}
		}
	}

	public static boolean isDirectory(String fn) {
		File file = new File(fn);
		if (file.exists()) {
			return file.isDirectory();
		}
		return IOUtils.class.getClassLoader().getResource(file.getPath().replaceAll("\\\\", "/") + "/") != null;
	}

	public static boolean isFile(String fn) {
		File file = new File(fn);
		if (file.exists()) {
			return true;
		}
		return IOUtils.class.getClassLoader().getResource(file.getPath().replaceAll("\\\\", "/")) != null
				&& IOUtils.class.getClassLoader().getResource(file.getPath().replaceAll("\\\\", "/") + "/") == null;
	}

	public static boolean delete(File file) {
		if (file.isDirectory()) {
			for (File child : file.listFiles()) {
				if (!delete(child)) {
					return false;
				}
			}
		}
		return file.delete();
	}

	public static class ReadFile extends InputStream {

		protected InputStream is = null;
		public String contentType = "";
		public Integer position = 0;
		public Integer fileSize = 0;
		public Long modTime = 0L;

		public ReadFile(InputStream is) {
			this.is = is;
		}

		public ReadFile(File file) {
			if (file == null) {
				return;
			}
			try {
				if (file.exists()) {
					is = new FileInputStream(file);
					fileSize = (int) file.length();
					modTime = file.lastModified();
				} else {
					URL url = IOUtils.class.getClassLoader().getResource(file.getPath().replaceAll("\\\\", "/"));
					if (url == null) {
						return;
					}
					URLConnection c = url.openConnection();
					is = c.getInputStream();
					if (is != null) {
						fileSize = c.getContentLength();
						modTime = c.getLastModified();
					}
				}
				if (is != null) {
					contentType = guessType(file);
				}
			} catch (IOException e) {
				e.printStackTrace(System.err);
			}
		}

		protected ReadFile() {

		}

		public boolean isNull() {
			return is == null;
		}

		@Override
		public boolean markSupported() {
			return is.markSupported(); // To change body of generated methods, choose Tools | Templates.
		}

		@Override
		public synchronized void reset() throws IOException {
			is.reset(); // To change body of generated methods, choose Tools | Templates.
		}

		@Override
		public synchronized void mark(int i) {
			is.mark(i); // To change body of generated methods, choose Tools | Templates.
		}

		@Override
		public void close() throws IOException {
			if (is == null)
				return;
			is.close(); // To change body of generated methods, choose Tools | Templates.
		}

		@Override
		public int available() throws IOException {
			return is.available(); // To change body of generated methods, choose Tools | Templates.
		}

		@Override
		public long skip(long l) throws IOException {
			position += (int) l;
			return is.skip(l); // To change body of generated methods, choose Tools | Templates.
		}

		@Override
		public int read(byte[] bytes, int i, int i1) throws IOException {
			int l = is.read(bytes, i, i1);
			if (l > 0)
				position += l;
			return l;
		}

		@Override
		public int read(byte[] bytes) throws IOException {
			int l = is.read(bytes);
			if (l > 0)
				position += l;
			return l;
		}

		@Override
		public int read() throws IOException {
			int l = is.read();
			if (l >= 0)
				++position;
			return l;
		}

	}

	public static int redirect(InputStream is, OutputStream os, int offset, int length) throws IOException {
		if (is == null) {
			os.close();
			return 0;
		}
		if (offset > 0) {
			is.skip(offset);
		}
		int written = 0;
		byte[] buffer = new byte[1024];
		int bytesRead;
		while ((bytesRead = is.read(buffer)) != -1) {
			if (length > 0 && length < bytesRead) {
				bytesRead = length;
			}
			os.write(buffer, 0, bytesRead);
			written += bytesRead;
			if (length > 0) {
				length -= bytesRead;
				if (length <= 0) {
					break;
				}
			}
		}
		os.close();
		return written;
	}

	public static void redirect(InputStream is, OutputStream os) throws IOException {
		redirect(is, os, 0, 0);
	}

	public static void redirect(ReadFile f, OutputStream os) throws IOException {
		redirect(f, os, 0, 0);
		if (f.fileSize > f.position) {
			throw new IOException("size mismatch");
		}
	}

	public static String read(InputStream is, int maxLines) throws IOException {
		String o = "";
		if (is == null) {
			return o;
		}
		try (Scanner s = new Scanner(is, "UTF-8")) {
			s.useDelimiter(maxLines > 0 ? "\\r?\\n" : "\\A");
			while (s.hasNext()) {
				if (!o.isEmpty()) {
					o += "\n";
				}
				o += s.next();
				if (maxLines > 0 && --maxLines == 0) {
					break;
				}
			}
		}
		return o;
	}

	public static String read(InputStream is) throws IOException {
		return read(is, 0);
	}

	public static byte[] compress(InputStream is) throws IOException {
		ByteArrayOutputStream bos = new ByteArrayOutputStream();
		GZIPOutputStream gos = new GZIPOutputStream(bos);
		redirect(is, gos);

		byte[] input = bos.toByteArray();
		int i = input.length;
		while (i-- > 0 && input[i] == 32) {
		}
		byte[] output = new byte[i + 1];
		System.arraycopy(input, 0, output, 0, i + 1);
		return Base64.getEncoder().encode(output);
	}

	public static ReadFile fetchURL(String url) throws IOException {
		return fetchURL(new URL(url), null, null);
	}

	public static ReadFile fetchURL(String url, Map<String, String> params) throws IOException {
		Map<String, String> headers = new HashMap<>();
		if (params != null && !params.isEmpty()) {
			headers.put("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
		}
		return fetchURL(new URL(url), buildQuery(params).getBytes("UTF-8"), headers);
	}

	public static ReadFile fetchURL(URL url, byte[] content, Map<String, String> headers) throws IOException {
		HttpURLConnection conn = (HttpURLConnection) url.openConnection();
		conn.setRequestProperty("User-Agent", GlobalConfig.UserAgent);
		if (headers != null) {
			headers.forEach((k, v) -> {
				conn.setRequestProperty(k, v);
			});
		}
		conn.setConnectTimeout(2000);
		conn.setReadTimeout(30000);

		if (content != null && content.length > 0) {
			conn.setDoOutput(true);
			conn.setRequestMethod("POST");
			conn.setRequestProperty("Content-Length", Integer.toString(content.length));
			try (DataOutputStream wr = new DataOutputStream(conn.getOutputStream())) {
				wr.write(content);
			}
		}

		if (conn.getResponseCode() > 299) {
			throw new IOException(
					"error fetching - " + url + ": " + conn.getResponseCode() + " " + conn.getResponseMessage());
		}
		ReadFile f = new ReadFile();
		f.is = conn.getInputStream();
		f.contentType = conn.getContentType();
		f.fileSize = conn.getContentLength();
		return f;
	}

	public static String buildQuery(Map<String, String> params) {
		if (params == null || params.isEmpty()) {
			return "";
		}
		StringBuilder result = new StringBuilder();
		boolean first = true;
		try {
			for (Map.Entry<String, String> entry : params.entrySet()) {
				if (entry.getValue() == null) {
					continue;
				}
				if (first) {
					first = false;
				} else {
					result.append("&");
				}
				result.append(URLEncoder.encode(entry.getKey(), "UTF-8"));
				result.append("=");
				result.append(URLEncoder.encode(entry.getValue(), "UTF-8"));
			}
		} catch (UnsupportedEncodingException e) {
			e.printStackTrace(System.err);
		}
		return result.toString();
	}

	public static String getFileExtension(File file) {
		String[] ext = file.getName().split("\\.");
		if (ext.length > 1) {
			return ext[ext.length - 1];
		}
		// TODO: guess by content
		return "";
	}

	public static String guessType(File file) {
		String contentType = IOUtils.MIME_TYPES.get(IOUtils.getFileExtension(file));
		if (contentType == null) {
			contentType = URLConnection.guessContentTypeFromName(file.getName());
		}
		// if (contentType == null) contentType =
		// URLConnection.guessContentTypeFromStream(is);
		if (contentType == null) {
			System.err.println("unknown mime type: " + file.getName());
			contentType = "application/octet-stream";
		}
		return contentType;
	}

	public static String md5(String text) {
		try {
			MessageDigest m = MessageDigest.getInstance("MD5");
			m.reset();
			m.update(text.getBytes());
			byte[] digest = m.digest();
			BigInteger bigInt = new BigInteger(1, digest);
			String hashtext = bigInt.toString(16);
			// Now we need to zero pad it if you actually want the full 32 chars.
			while (hashtext.length() < 32) {
				hashtext = "0" + hashtext;
			}
			return hashtext;
		} catch (NoSuchAlgorithmException e) {
			e.printStackTrace(System.err);
			return "??";
		}
	}

	public static long getPid() {
		RuntimeMXBean bean = ManagementFactory.getRuntimeMXBean();

		// Get name representing the running Java virtual machine.
		// It returns something like 6460@AURORA. Where the value
		// before the @ symbol is the PID.
		String jvmName = bean.getName();

		// Extract the PID by splitting the string returned by the
		// bean.getName() method.
		return Long.valueOf(jvmName.split("@")[0]);
	}

	public static void killByPid(long pid) throws IOException {
		if (!System.getProperty("os.name").toLowerCase().contains("win")) {
			Runtime.getRuntime().exec("kill -9 " + pid);
		} else {
			Runtime.getRuntime().exec("taskkill /F /PID " + pid);
		}
	}

	public static boolean globalMutex(String filename, boolean confirm) throws IOException {
		File pid = new File(filename);
		if (pid.exists()) {
			boolean response = true;
			if (confirm) {
				response = TimedDialog.create("Program is already running!\nRestart?", 5, true) == TimedDialog.YES;
			}
			if (!response)
				return false;

			IOUtils.ReadFile r = new ReadFile(pid);
			String p = read(r);
			killByPid(Long.parseLong(p));
			try {
				Thread.sleep(500);
			} catch (InterruptedException e) {
			}
		}
		try (PrintStream pf = new PrintStream(new FileOutputStream(pid))) {
			pf.print(IOUtils.getPid());
		}
		pid.deleteOnExit();
		return true;
	}
}
