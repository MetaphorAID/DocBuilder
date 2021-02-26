/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package hu.tempus.HtmlGui;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.io.UnsupportedEncodingException;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.json.Json;
import javax.json.JsonArrayBuilder;
import javax.json.JsonNumber;
import javax.json.JsonObjectBuilder;
import javax.json.JsonString;
import javax.json.JsonStructure;
import javax.json.JsonValue;
import javax.json.JsonWriter;

/**
 *
 * @author TeMPuS
 */
public class JsonHelper {

	public static JsonValue pojoToJson(Object o) {

		if (o == null) {
			return JsonValue.NULL;
		}

		if (o instanceof JsonValue) {
			return (JsonValue) o;
		}

		String className = o.getClass().getName();

		{ // Primitives
			JsonArrayBuilder json = Json.createArrayBuilder();

			switch (className) {
				case "java.lang.Boolean":
					return (boolean) o ? JsonValue.TRUE : JsonValue.FALSE;
				case "java.lang.Integer":
					return json.add((int) o).build().getJsonNumber(0);
				case "java.lang.Long":
					return json.add((long) o).build().getJsonNumber(0);
				case "java.lang.Double":
					return json.add((double) o).build().getJsonNumber(0);
				case "java.lang.String":
					return json.add((String) o).build().getJsonString(0);
				case "java.util.ArrayList":
				case "java.util.HashSet":
				case "java.util.TreeSet":
				case "java.util.concurrent.ConcurrentSkipListSet":
				case "java.util.concurrent.ConcurrentLinkedQueue":
					@SuppressWarnings("unchecked") Iterable<Object> l = (Iterable<Object>) o;
					for (Object l1 : l) {
						json.add(pojoToJson(l1));
					}
					return json.build();
				case "java.util.HashMap":
				case "java.util.TreeMap":
				case "java.util.LinkedHashMap":
				case "java.util.concurrent.ConcurrentHashMap":
				case "java.util.concurrent.ConcurrentSkipListMap":
					@SuppressWarnings("unchecked") Map<String, Object> m = (Map<String, Object>) o;
					JsonObjectBuilder jsonX = Json.createObjectBuilder();
					m.entrySet().stream().forEach((m1) -> {
						jsonX.add(m1.getKey(), pojoToJson(m1.getValue()));
					});
					return jsonX.build();
				case "java.util.Date":
					Date d = (Date) o;
					SimpleDateFormat dt = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
					return json.add(dt.format(d)).build().getJsonString(0);
			}
		}

		Field[] fields = o.getClass().getFields();
		if (className.startsWith("java.lang") || (fields.length == 0)) {
			throw new Error("Unhandled type: " + className);
		}

		JsonObjectBuilder json = Json.createObjectBuilder();
		for (Field f : fields) {
			if (!Modifier.isPublic(f.getModifiers())) {
				continue;
			}
			try {
				json.add(f.getName(), pojoToJson(f.get(o)));
			} catch (IllegalArgumentException | IllegalAccessException e) {
				Logger.error(e);
			}
		}
		return json.build();
	}

	public static Object jsonToPojo(JsonValue o) {
		switch (o.getValueType()) {
			case FALSE:
				return Boolean.FALSE;
			case TRUE:
				return Boolean.TRUE;
			case NUMBER: {
				JsonNumber num = (JsonNumber) o;
				return num.isIntegral() ? num.intValue() : num.doubleValue();
			}
			case STRING:
				return ((JsonString) o).getString();
			case OBJECT: {
				Map<String, Object> ret = new HashMap<>();
				o.asJsonObject().forEach((k, v) -> {
					ret.put(k, jsonToPojo(v));
				});
				return ret;
			}
			case ARRAY: {
				List<Object> ret = new ArrayList<>();
				o.asJsonArray().forEach((i) -> {
					ret.add(jsonToPojo(i));
				});
				return ret;
			}
			default:
				return null;
		}
	}

	public static void serialize(OutputStream os, JsonStructure json) {
		try (JsonWriter writer = Json.createWriter(os)) {
			writer.write(json);
		} catch (Exception e) {
			Logger.error("Could not serialize json object: " + e.getMessage());
		}
	}

	public static byte[] serialize(Map<String, Object> json) {
		return serialize((JsonStructure) pojoToJson(json));
	}

	public static byte[] serialize(JsonStructure json) {
		try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
			serialize(os, json);
			return os.toByteArray();
		} catch (Exception e) {
			Logger.error("Could not serialize json object: " + e.getMessage());
		}
		return null;
	}

	public static JsonStructure parse(InputStream is) {
		try {
			if (is == null) {
				return null;
			}
			return parse(new InputStreamReader(is, "UTF-8"));
		} catch (UnsupportedEncodingException e) {
			Logger.error("Could not parse json string: " + e.getMessage());
		}
		return null;
	}

	public static JsonStructure parse(Reader r) {
		return Json.createReader(r).read();
	}
}
