package hu.tempus.HtmlGui;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.StringReader;
import java.io.UnsupportedEncodingException;
import java.net.InetSocketAddress;
import java.net.UnknownHostException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import javax.json.JsonObject;
import javax.json.JsonStructure;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

public class DataChannels extends WebSocketServer {

	protected static final SimpleDateFormat DF = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
	protected static final Map<String, Map<String, Object>> CHANNELS = new HashMap<>();
	protected static final Map<String, Set<WebSocket>> SUBSCRIBERS = new HashMap<>();
	protected static File backupFile = null;

	public DataChannels(InetSocketAddress address) throws UnknownHostException {
		super(address);
	}

	public static void setBackup(String filename) {
		backupFile = new File(filename);
		if (backupFile.exists()) {
			try {
				InputStream is = new FileInputStream(backupFile);
				@SuppressWarnings("unchecked")
				Map<String, Map<String, Object>> load = (Map<String, Map<String, Object>>) JsonHelper
						.jsonToPojo(JsonHelper.parse(is));
				synchronized (CHANNELS) {
					CHANNELS.putAll(load);
				}
			} catch (Exception e) {
				Logger.error(e);
			}
		}
	}

	protected static void backup() {
		if (backupFile == null) {
			return;
		}
		synchronized (CHANNELS) {
			try {
				OutputStream os = new FileOutputStream(backupFile);
				JsonHelper.serialize(os, (JsonStructure) JsonHelper.pojoToJson(CHANNELS));
			} catch (Exception e) {
				Logger.error(e);
			}
		}
	}

	public static Map<String, Object> getChannelData(String channel) {
		Map<String, Object> data;
		synchronized (CHANNELS) {
			data = CHANNELS.get(channel);
			if (data == null) {
				data = new HashMap<>();
				CHANNELS.put(channel, data);
			}
		}
		return data;
	}

	public static void setChannelData(String channel, String key, Object value) {
		Map<String, Object> data = getChannelData(channel);
		synchronized (data) {
			if (value == null) {
				data.remove(key);
			} else {
				data.put(key, value);
			}
		}
		broadcast(channel, data);
		backup();
	}

	public static void setChannelData(String channel, Map<String, String> items) {

		Map<String, Object> data = getChannelData(channel);
		synchronized (data) {
			items.entrySet().forEach((i) -> {
				if (i.getValue() == null) {
					data.remove(i.getKey());
				} else {
					data.put(i.getKey(), i.getValue());
				}
			});
		}
		broadcast(channel, data);
		backup();
	}

	public static void broadcast(String channel, Map<String, Object> data) {
		try {
			String resp;
			synchronized (data) {
				resp = new String(JsonHelper.serialize(data), "UTF-8");
			}
			synchronized (SUBSCRIBERS) {
				Set<WebSocket> sub = SUBSCRIBERS.get(channel);
				if (sub == null) {
					return;
				}
				Set<WebSocket> closed = new HashSet<>();
				for (WebSocket s : sub) {
					if (s.isOpen()) {
						s.send(resp);
					} else {
						closed.add(s);
					}
				}
				for (WebSocket s : closed) {
					sub.remove(s);
				}
			}
		} catch (UnsupportedEncodingException e) {
			Logger.error(e);
		}
	}

	@Override
	public void onOpen(WebSocket conn, ClientHandshake handshake) {
		String channel = conn.getResourceDescriptor().substring(1);
		synchronized (SUBSCRIBERS) {
			if (!SUBSCRIBERS.containsKey(channel)) {
				SUBSCRIBERS.put(channel, new HashSet<>());
			}
			SUBSCRIBERS.get(channel).add(conn);
		}
	}

	@Override
	public void onMessage(WebSocket conn, String message) {
		String[] m = message.split("\r?\n", 2);
		String channel = conn.getResourceDescriptor().substring(1);
		Map<String, Object> data = getChannelData(channel);
		switch (m.length > 1 ? m[0] : message) {
			case "set":
				if (m.length > 1) {
					synchronized (data) {
						JsonObject items = (JsonObject) JsonHelper.parse(new StringReader(m[1]));
						items.entrySet().forEach((i) -> {
							data.put(i.getKey(), i.getValue());
						});
					}
				}
				backup();
				broadcast(channel, data);
				break;
			case "ping":
				synchronized (data) {
					data.put("ping", DF.format(new Date()));
				}
				broadcast(channel, data);
				break;
			case "get":
				try {
					String resp = new String(JsonHelper.serialize(data), "UTF-8");
					conn.send(resp);
				} catch (UnsupportedEncodingException e) {
					Logger.error(e);
				}
				break;

			default:
				conn.send("UNKNOWN COMMAND");
		}
	}

	@Override
	public void onClose(WebSocket conn, int code, String reason, boolean remote) {
		synchronized (SUBSCRIBERS) {
			SUBSCRIBERS.get(conn.getResourceDescriptor()).remove(conn);
		}
	}

	@Override
	public void onError(WebSocket conn, Exception e) {
		Logger.error(e);
	}

	@Override
	public void onStart() {

	}

}
