package hu.tempus.HtmlGui;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.text.SimpleDateFormat;
import java.util.Date;

public class Logger {
	public static final int ERROR = 1;
	public static final int INFO = 2;
	public static final int DEBUG = 3;

	protected static PrintStream[] mStream = new PrintStream[3];

	public static void initialize(int level, String filename) throws Exception {
		try (OutputStream out = new FileOutputStream(new File(filename), true)) {
			mStream[0] = level >= 1 ? new LogStream("ERROR", out) : new PrintStream(new NullStream());
			mStream[1] = level >= 2 ? new LogStream("INFO", out) : new PrintStream(new NullStream());
			mStream[2] = level >= 3 ? new LogStream("DEBUG", out) : null;
		}
		System.setErr(mStream[0]);
		System.setOut(mStream[1]);
	}

	public static void error(Exception e) {
		e.printStackTrace(System.err);
	}

	public static void error(String message) {
		System.err.println(message);
	}

	public static void info(String message) {
		System.out.println(message);
	}

	public static void debug(Exception e) {
		if (mStream[2] != null)
			e.printStackTrace(mStream[2]);
	}

	public static void debug(String message) {
		if (mStream[2] != null)
			mStream[2].println(message);
	}

	protected static class LogStream extends PrintStream {
		protected static final SimpleDateFormat DF = new SimpleDateFormat("[yyyy-MM-dd HH:mm:ss]");
		protected final String mChannel;

		public LogStream(String channel, OutputStream out) {
			super(out);
			mChannel = " [" + channel + "] ";
		}

		@Override
		public void println(String txt) {
			super.println(DF.format(new Date()) + mChannel + txt);
		}
	}

	protected static class NullStream extends OutputStream {
		@Override
		public void write(int b) throws IOException {
		}
	}
}
