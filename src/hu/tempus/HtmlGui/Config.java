package hu.tempus.HtmlGui;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;

public class Config {

	private final Map<String, Config> mSectionMap;
	private final Map<String, String> mValueMap;
	private final Config mRoot;

	private File saveOnChange;

	public Config() {
		this(null);
	}

	private Config(Config root) {
		mRoot = root == null ? this : root;
		mSectionMap = new ConcurrentHashMap<>();
		mValueMap = new ConcurrentHashMap<>();
		saveOnChange = null;
	}

	public Config read(JsonObject values) {
		if (values == null) {
			return this;
		}
		values.entrySet().stream().forEach((f) -> {
			if (f.getValue().isJsonObject()) {
				mSectionMap.put(f.getKey(), new Config(mRoot).read((JsonObject) f.getValue()));
			} else {
				mValueMap.put(f.getKey(), f.getValue().getAsString());
			}
		});
		return this;
	}

	public Config read(String fileName) {

		IOUtils.ReadFile fs = new IOUtils.ReadFile(new File(fileName));
		if (fs.isNull()) {
			Logger.error("Config file not found: " + fileName);
			return this;
		}

		read(new Gson().fromJson(new InputStreamReader(fs), JsonObject.class));

		return this;
	}

	public void saveOnChange(String fileName) {
		saveOnChange = new File(fileName);
	}

	public Map<String, Config> getChildren() {
		return mSectionMap;
	}

	public Config getChild(String key) {
		if (mSectionMap.containsKey(key)) {
			return mSectionMap.get(key);
		}
		Config c = new Config(mRoot);
		mSectionMap.put(key, c);
		return c;
	}

	public void delChild(String key) {
		Config prev = mSectionMap.remove(key);
		if (prev != null) {
			changed();
		}
	}

	public Map<String, String> getValues() {
		return mValueMap;
	}

	public String getValue(String key) {
		return getValue(key, null);
	}

	public String getValue(String key, String def) {
		return mValueMap.getOrDefault(key, def);
	}

	public void setValue(String key, String value) {
		String prev = mValueMap.put(key, value);
		if (!value.equals(prev)) {
			changed();
		}
	}

	public void delValue(String key) {
		String prev = mValueMap.remove(key);
		if (prev != null) {
			changed();
		}
	}

	public JsonObject dump() {
		JsonObject jsonX = new JsonObject();

		mValueMap.forEach((key, value) -> {
			jsonX.add(key, new JsonPrimitive(value));
		});

		mSectionMap.forEach((key, value) -> {
			jsonX.add(key, value.dump());
		});

		return jsonX;
	}

	private void changed() {
		if (mRoot.saveOnChange != null) {
			mRoot.write(mRoot.saveOnChange);
		}
	}

	public void write(File file) {
		synchronized (this) {
			try {
				try (FileOutputStream os = new FileOutputStream(file, false)) {
					os.write(new Gson().toJson(dump()).getBytes("UTF-8"));
				}
			} catch (IOException e) {
				Logger.error("Could not save config: " + file.getAbsolutePath());
			}
		}
	}
}
