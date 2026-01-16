package hu.tempus.DocBuilder;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import javax.swing.JFileChooser;
import javax.swing.JFrame;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import hu.tempus.DocBuilder.DocFilter.Chunk;
import hu.tempus.HtmlGui.IOUtils;

public class DocEditor {

	protected static final ConcurrentMap<String, DocEditor> FILES = new ConcurrentHashMap<>();
	protected static final Map<String, DocFilter> TEMPLATES = new HashMap<>();

	protected final Template mTemplate;
	protected List<Chunk> mChunks;
	protected Map<Integer, Chunk> mChunkRefs;

	protected DocEditor(Template template) throws IOException {
		mTemplate = template;
		String content;
		if (!mTemplate.file.exists()) {
			content = mTemplate.filter.getDefaultContent();
		} else {
			content = IOUtils.read(new FileInputStream(mTemplate.file));
		}
		mChunks = mTemplate.filter.getChunks(content);
		mChunkRefs = new HashMap<>();
		for (Chunk chunk : mChunks) {
			if (chunk.id == null)
				continue;
			mChunkRefs.put(chunk.id, chunk);
		}
		FILES.put(this.getId(), this);
	}

	public static void addTemplate(File file) {
		DocFilter filter = new DocFilter(file);
		TEMPLATES.put(filter.getId(), filter);
	}

	public static DocEditor load(String fileId, Boolean reload) throws IOException {
		DocEditor editor = reload ? null : FILES.get(fileId);
		if (editor == null) {
			editor = new DocEditor(new Template(fileId));
		}
		return editor;
	}

	public static DocEditor open(String lastFileId) throws IOException {
		Template tpl = choose(lastFileId.isEmpty() ? null : new Template(lastFileId), "Create/Open a file", "Open");
		if (tpl == null)
			return null;
		return new DocEditor(tpl);
	}

	public String getId() {
		return mTemplate.id;
	}

	public List<Chunk> getChunks() {
		return mChunks;
	}

	public List<String> getJS() {
		return mTemplate.filter.getJS();
	}

	public List<String> getCSS() {
		return mTemplate.filter.getCSS();
	}

	public void setChunks(JsonArray chunks) {
		Iterator<JsonElement> uit = chunks.iterator();
		while (uit.hasNext()) {
			JsonObject u = (JsonObject) uit.next();
			Chunk c = mChunkRefs.get(u.has("id") ? u.get("id").getAsInt() : 0);
			if (c != null) {
				c.value = (u.has("append") && u.get("append").getAsBoolean() ? c.value : "") + (u.has("value") ? u.get("value").getAsString() : "");
			}
		}
	}

	public void save(boolean create) throws Exception {
		if (create) {
			Template tpl = choose(mTemplate, "Save the file", "Save");
			if (tpl == null)
				return;
			buildFile(tpl.file);
		}
		buildFile(mTemplate.file);
	}

	protected static Template choose(Template current, String title, String button) throws IOException {
		JFrame frame = new JFrame();
		frame.setAlwaysOnTop(true);

		JFileChooser chooser = new JFileChooser();
		if (current == null) {
			chooser.setCurrentDirectory(new File(System.getProperty("user.home")));
		} else {
			chooser.setSelectedFile(current.file);
		}
		chooser.setDialogTitle(title);

		for (DocFilter tpl : TEMPLATES.values()) {
			chooser.addChoosableFileFilter(tpl);
		}
		if (TEMPLATES.size() > 0) {
			if (current != null) {
				chooser.setFileFilter(current.filter);
			}
			chooser.setAcceptAllFileFilterUsed(false);
		}

		int result = chooser.showDialog(frame, button);
		if (result == JFileChooser.APPROVE_OPTION) {
			return new Template((DocFilter) chooser.getFileFilter(), chooser.getSelectedFile());
		}
		return null;
	}

	synchronized public void buildFile(File file) throws Exception {
		OutputStream os = new FileOutputStream(file, false);
		for (Chunk chunk : mChunks) {
			if (chunk.id == null)
				continue;
			os.write(chunk.value.getBytes("UTF-8"));
		}
		os.close();
	}

	protected static class Template {
		public final String id;
		public final DocFilter filter;
		public final File file;

		protected Template(DocFilter filter, File file) throws IOException {
			this.filter = filter;
			this.file = file;
			this.id = file.getCanonicalPath() + "\t" + filter.getId();
		}

		protected Template(String id) throws IOException {
			String[] parts = id.split("\t");
			this.file = new File(parts[0]);
			this.filter = parts.length > 1 ? TEMPLATES.get(parts[1]) : null;
			if (this.filter == null) {
				throw new IOException("Template does not exist");
			}
			this.id = id;
		}

		@Override
		public boolean equals(Object o) {
			if (o == this)
				return true;
			if (!(o instanceof Template))
				return false;
			Template tpl = (Template) o;
			return tpl.id.equals(this.id);
		}

	}

}
