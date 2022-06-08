package hu.tempus.DocBuilder;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.json.JsonObject;
import javax.json.JsonString;
import javax.swing.filechooser.FileFilter;
import javax.swing.filechooser.FileNameExtensionFilter;

import hu.tempus.HtmlGui.IOUtils;
import hu.tempus.HtmlGui.JsonHelper;

public class DocFilter extends FileFilter {
	protected final String mId;
	protected final String[] mExtension;
	protected final FileFilter mFilter;
	protected final File mDefaultContent;
	protected final Map<String, String> mSplitter;
	protected final List<String> mJS = new ArrayList<>();
	protected final List<String> mCSS = new ArrayList<>();

	public DocFilter(File file) {
		JsonObject config = (JsonObject) JsonHelper.parse(new IOUtils.ReadFile(file));
		mId = file.getName().replace("\\.json$", "");
		mExtension = config.getString("extension", "").split("[,;] *");
		mFilter = new FileNameExtensionFilter(config.getString("name", file.getName().replace("\\.[^.]+$", "")),
				mExtension);
		String cf = config.getString("template", "");
		mDefaultContent = cf.isEmpty() ? null : new File(cf);
		mSplitter = new LinkedHashMap<>();
		config.getJsonObject("chunks").forEach((name, value) -> mSplitter.put(name, ((JsonString) value).getString()));
		for (String js : config.getString("js", "").split("[,;] *")) {
			if (!js.isEmpty()) {
				mJS.add(file.getParent() + "/" + js);
			}
		}
		for (String css : config.getString("css", "").split("[,;] *")) {
			if (!css.isEmpty()) {
				mCSS.add(file.getParent() + "/" + css);
			}
		}
	}

	public String getId() {
		return mId;
	}

	public String getExtension(boolean with_dot) {
		String ext = mExtension[0];
		return !ext.isEmpty() ? "." + ext : "";
	}

	public List<String> getJS() {
		return mJS;
	}

	public List<String> getCSS() {
		return mCSS;
	}

	public static class Chunk {
		public Integer id;
		public final String name;
		public String value;

		protected Chunk(Integer id, String name, String value) {
			this.id = id;
			this.name = name;
			this.value = value;
		}
	}

	public List<Chunk> getChunks(String content) {
		Map<Integer[], Chunk> matches = new TreeMap<>((a, b) -> a[0] == b[0] ? b[1].compareTo(a[1]) : a[0].compareTo(b[0]));
		mSplitter.forEach((match, key) -> {
			Pattern p = Pattern.compile(match, Pattern.DOTALL);
			Matcher m = p.matcher(content);
			while (m.find()) {
				Integer[] p1 = { m.start(), m.end() };
				matches.put(p1, new Chunk(null, key, m.group()));
			}
		});
		List<Chunk> chunks = new ArrayList<>();
		int pos = 0;
		int id = 0;
		for (Map.Entry<Integer[], Chunk> match : matches.entrySet()) {
			Chunk c = match.getValue();
			int start = match.getKey()[0];
			if (pos > start) {
				chunks.add(c);
				continue;
			}
			if (pos < start) {
				chunks.add(new Chunk(++id, "", content.substring(pos, start)));
			}
			c.id = ++id;
			chunks.add(c);
			pos = match.getKey()[1];
		}
		if (pos < content.length()) {
			chunks.add(new Chunk(++id, "", content.substring(pos)));
		}
		return chunks;
	}

	public String getDefaultContent() throws IOException {
		if (mDefaultContent == null) {
			throw new IOException("This template does not support file creation");
		}
		return IOUtils.read(new IOUtils.ReadFile(mDefaultContent));
	}

	@Override
	public boolean accept(File f) {
		return mFilter.accept(f);
	}

	@Override
	public String getDescription() {
		return mFilter.getDescription();
	}

}
