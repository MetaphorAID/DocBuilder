package hu.tempus.HtmlGui;

import java.awt.Desktop;
import java.io.BufferedInputStream;
import java.io.File;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URL;
import java.security.KeyStore;
import java.util.concurrent.Executors;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsServer;

import org.java_websocket.server.DefaultSSLWebSocketServerFactory;

public class WebServer {

	private final Config mConfig;
	private final RequestHandler mRequestHandler;
	private int mPortHTTP, mPortHTTPS, mPortWS, mPortWSS;
	private InetAddress mAddress;
	private String mHostname;
	private String mBrowser = null;
	private HttpServer mServerHTTP = null;
	private HttpsServer mServerHTTPS = null;
	private DataChannels mServerWS = null, mServerWSS = null;

	public WebServer(Config config, RequestHandler requestHandler) throws Exception {

		mConfig = config;
		mRequestHandler = requestHandler;

		mPortHTTP = Integer.parseInt(mConfig.getValue("port", "80"));
		mPortHTTPS = Integer.parseInt(mConfig.getValue("port_ssl", "0"));
		mPortWS = Integer.parseInt(mConfig.getValue("port_ws", "0"));
		mPortWSS = Integer.parseInt(mConfig.getValue("port_wss", "0"));

		// Privileged port workaround
		if (!System.getProperty("os.name").toLowerCase().contains("win")) {
			if (mPortHTTP < 1024) {
				mPortHTTP += 2000;
			}
			if (mPortHTTPS > 0 && mPortHTTPS < 1024) {
				mPortHTTPS += 2000;
			}
			if (mPortWS > 0 && mPortWS < 1024) {
				mPortWS += 2000;
			}
			if (mPortWS > 0 && mPortWSS < 1024) {
				mPortWSS += 2000;
			}
		}

		System.setProperty("java.net.preferIPv4Stack", "true");

		try (DatagramSocket s = new DatagramSocket()) {
			s.connect(InetAddress.getByAddress(new byte[] { 8, 8, 8, 8 }), 0);
			mAddress = s.getLocalAddress();
			mHostname = mAddress.getHostAddress();
		} catch (Exception e) {
			mAddress = InetAddress.getByAddress(new byte[] { 127, 0, 0, 1 });
			mHostname = "localhost";
		}
	}

	public void init() throws Exception {

		mServerHTTP = HttpServer.create(new InetSocketAddress(mPortHTTP), 0);
		;
		mServerHTTP.createContext("/", mRequestHandler);
		mServerHTTP.setExecutor(Executors.newCachedThreadPool()); // creates a default executor

		if (mPortWS > 0) {
			mServerWS = new DataChannels(new InetSocketAddress(mPortWS));
		} else {
			mServerWS = null;
		}

		if (mPortHTTPS > 0 || mPortWSS > 0) {
			SSLContext sslContext = SSLContext.getInstance("TLS");

			// initialise the keystore
			IOUtils.ReadFile r = new IOUtils.ReadFile(new File("ssl.jks"));
			KeyStore ks = KeyStore.getInstance("JKS");
			ks.load(r, mConfig.getValue("storepass").toCharArray());

			// setup the key manager factory
			KeyManagerFactory kmf = KeyManagerFactory.getInstance("SunX509");
			kmf.init(ks, mConfig.getValue("keypass").toCharArray());

			// setup the trust manager factory
			TrustManagerFactory tmf = TrustManagerFactory.getInstance("SunX509");
			tmf.init(ks);

			// setup the HTTPS context and parameters
			sslContext.init(kmf.getKeyManagers(), tmf.getTrustManagers(), null);

			if (mPortHTTPS > 0) {
				mServerHTTPS = HttpsServer.create(new InetSocketAddress(mPortHTTPS), 0);
				mServerHTTPS.setHttpsConfigurator(new HttpsConfigurator(sslContext));
			}

			if (mServerHTTPS != null) {
				mServerHTTPS.createContext("/", mRequestHandler);
				mServerHTTPS.setExecutor(Executors.newCachedThreadPool()); // creates a default executor
			}

			if (mPortWSS > 0) {
				mServerWSS = new DataChannels(new InetSocketAddress(mPortWSS));
				mServerWSS.setWebSocketFactory(new DefaultSSLWebSocketServerFactory(sslContext));
			}
		}
	}

	public void start() throws Exception {
		if (mServerHTTP != null) {
			mServerHTTP.start();
		}
		if (mServerHTTPS != null) {
			mServerHTTPS.start();
		}
		if (mServerWS != null) {
			mServerWS.start();
		}
		if (mServerWSS != null) {
			mServerWSS.start();
		}
		Runtime.getRuntime().addShutdownHook(new OnShutdown());
		if (mServerHTTP != null) {
			Logger.debug("Server started");
		}

		mRequestHandler.setServer(this).onStart();
		startBrowser();
		if (mServerHTTP == null) {
			System.exit(0);
		}
	}

	public void stop() {
		if (mServerHTTP != null) {
			mServerHTTP.stop(1);
		}
		if (mServerHTTPS != null) {
			mServerHTTPS.stop(1);
		}
		if (mServerWS != null) {
			try {
				mServerWS.stop(1);
			} catch (InterruptedException e) {
			}
		}
		if (mServerWSS != null) {
			try {
				mServerWSS.stop(1);
			} catch (InterruptedException e) {
			}
		}
		Logger.debug("Server stopped");
	}

	public void setBrowser(String browser) {
		mBrowser = browser;
	}

	public void startBrowser() throws Exception {
		if (mBrowser == null) {
			return;
		}
		if (mBrowser.isEmpty()) {
			Desktop desktop = Desktop.isDesktopSupported() ? Desktop.getDesktop() : null;
			if (desktop != null && !desktop.isSupported(Desktop.Action.BROWSE)) {
				desktop = null;
			}
			if (desktop != null) {
				desktop.browse(new URI("http://localhost:" + mPortHTTP));
				Logger.debug("Browser launched");
			}
			return;
		}
		Runtime.getRuntime().exec(mBrowser + " http://localhost:" + mPortHTTP);
	}

	public void remoteStop() {
		try {
			BufferedInputStream tmp = new BufferedInputStream(new URL(getBaseUrl("http") + "/exit").openStream());
			tmp.close();
			Thread.sleep(2000);
		} catch (Exception e) {
		}
	}

	public InetAddress getAddress() {
		return mAddress;
	}

	public boolean hasServer(String protocol) {
		switch (protocol) {
			case "ws":
				return mPortWS > 0;
			case "wss":
				return mPortWSS > 0;
			case "http":
				return mPortHTTP > 0;
			case "https":
				return mPortHTTPS > 0;
		}
		return false;
	}

	public String getBaseUrl(String protocol) {
		switch (protocol) {
			case "https":
			case "web":
				protocol = mPortHTTPS > 0 ? "https" : "http";
				break;
			case "wss":
			case "data":
				protocol = mPortWSS > 0 ? "wss" : "ws";
				break;
		}
		switch (protocol) {
			case "ws":
				return protocol + "://" + mHostname + ":" + mPortWS;
			case "wss":
				return protocol + "://" + mHostname + ":" + mPortWSS;
			case "http":
				return protocol + "://" + mHostname + (mPortHTTP != 80 ? ":" + mPortHTTP : "");
			case "https":
				return protocol + "://" + mHostname + (mPortHTTPS != 443 ? ":" + mPortHTTPS : "");
		}
		return null;
	}

	/* Responds to a JVM shutdown by stopping the server. */
	class OnShutdown extends Thread {

		@Override
		public void run() {
			WebServer.this.stop();
		}
	}
}
