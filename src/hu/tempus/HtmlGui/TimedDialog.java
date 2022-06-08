package hu.tempus.HtmlGui;

import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JOptionPane;

public class TimedDialog implements Runnable {

	public static int NO = 1;
	public static int YES = 2;

	private final JOptionPane optionPane;
	private final JDialog dialog;
	private int state = 0;
	private Thread thread = null;
	private int seconds = 0;
	private final int timeout;

	public static int create(String message, int timeout, boolean confirm) {
		TimedDialog td = new TimedDialog(message, timeout, confirm, true);
		td.start();
		return td.getState();
	}

	public TimedDialog(String message, int timeout, boolean confirm, boolean modal) {
		JFrame frame = new JFrame();
		frame.setAlwaysOnTop(true);

		this.timeout = timeout;

		optionPane = new JOptionPane(message, confirm ? JOptionPane.QUESTION_MESSAGE : JOptionPane.WARNING_MESSAGE,
				confirm ? JOptionPane.YES_NO_OPTION : JOptionPane.DEFAULT_OPTION);

		dialog = new JDialog(frame, "Closing in " + timeout + " seconds", true);
		dialog.setContentPane(optionPane);
		dialog.setDefaultCloseOperation(JDialog.DO_NOTHING_ON_CLOSE);
		dialog.setModal(modal);

		optionPane.addPropertyChangeListener(new PropertyChangeListener() {
			public void propertyChange(PropertyChangeEvent e) {
				String prop = e.getPropertyName();

				if (dialog.isVisible() && (e.getSource() == optionPane) && (prop.equals(JOptionPane.VALUE_PROPERTY))) {
					state = (int) e.getNewValue() == JOptionPane.YES_OPTION ? YES : NO;

					dialog.setVisible(false);
				}
			}
		});

		dialog.pack();
		dialog.setLocationRelativeTo(null);
	}

	public void start() {

		// int value = ((Integer)optionPane.getValue()).intValue();
		// if (value == JOptionPane.YES_OPTION) {
		// setLabel("Good.");
		// } else if (value == JOptionPane.NO_OPTION) {
		// setLabel("Try using the window decorations "
		// + "to close the non-auto-closing dialog. "
		// + "You can't!");
		// }

		// jButton_YES.addActionListener(this);
		// jButton_NO.addActionListener(this);
		thread = new Thread(this);
		thread.start();
		dialog.setVisible(true);
	}

	public void stop() {
		dialog.setVisible(false);
	}

	@Override
	public void run() {
		while (seconds < timeout) {
			seconds++;
			dialog.setTitle("Closing in " + (timeout - seconds) + " seconds");
			try {
				Thread.sleep(1000);
			} catch (InterruptedException exc) {
			}
		}
		dialog.setVisible(false);
	}

	public int getState() {
		return state;
	}

}
