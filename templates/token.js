class TOKEN {
	static SEL_BOOL = {
		'True': 'True',
		'False': 'False',
	}

	static SEL_WHERE = {
		'0': 'Before',
		'1': 'After',
	}

	static MORPH_HEADERS = Object.freeze(['Token', 'Lemma', 'Detailed', 'Simple', ''])
	static EMPTY_TEXT = '\xa0'

	static initalize() {
		// Common
		Locale['EMPTY'] = 'ÜRES';
		Locale['Invalid Action'] = 'Nem végrehajtható akció';
		Locale['Invalid Format'] = 'Hibás formátum';

		Locale['True'] = 'Igaz';
		Locale['False'] = 'Hamis';
		Locale['Before'] = 'Előtte';
		Locale['After'] = 'Utána';

		Locale['Fix Token'] = 'Token javítása';
		Locale['Sticks To...'] = 'Ragadás...';
		Locale['Sticks Left'] = 'Balra ragad';
		Locale['Sticks Right'] = 'Jobbra ragad';
		Locale['Sticks Both'] = 'Mindkettőre ragad';
		Locale['Does Not Stick'] = 'Nem ragad';
		Locale['Join Token...'] = 'Token összevon...';
		Locale['Delete Token'] = 'Token törlése';
		Locale['Insert Token'] = 'Token beszúrása';
		// Locale lookups are exact, so callers must keep `%word%` in the key
		// and let TOKEN.createLink() substitute the runtime token text after `_()`
		Locale['Insert Before <b>%word%</b>'] = 'Beszúrás <b>%word%</b> elé';
		Locale['Insert After <b>%word%</b>'] = 'Beszúrás <b>%word%</b> után';

		Locale['Split Token...'] = 'Token szétszed...';
		Locale['Move Sentence...'] = 'Mondat mozgat...';
		Locale['Join Sentence...'] = 'Mondat összevon...';
		Locale['Split Sentence...'] = 'Mondat szétszed...';

		Locale['Edit'] = 'Szerkeszt';
		Locale['Save'] = 'Elment';

		evt(editor.dom, 'document-before-render', () => {
			sel('#header').replaceChildren();
			sel('#footer').replaceChildren();
			sel('header .btn-view')?.remove();
		});

		evt(editor.dom, 'document-ready', () => {
			// Add Normal/Table view swithcher button
			if (!sel('header .btn-view')) {
				const a = document.createElement('a');
				a.href = '#';
				a.className = 'btn btn-view';
				a.textContent = _(localStorage.tableview ? 'Normal View' : 'Table View');

				sel('header').appendChild(a);
			}
		});

		document.addEventListener('click', (e) => {
			const t = e.target;
			if (!t) return;

			// Change view
			if (t.matches('.btn-view')) {
				localStorage.tableview = localStorage.tableview ? '' : '1';
				sel('header .btn-view').textContent = _(localStorage.tableview ? 'Normal View' : 'Table View');
				editor.renderPage(editor.getVisible());
			}
		});
	}

	static createSettingsRow(tableView, columnCount) {
		const row = document.createElement(tableView ? 'tr' : 'span');
		row.className = 'cfg';

		if (tableView) {
			const cell = document.createElement('td');
			cell.colSpan = columnCount;
			cell.className = 'as-parent';
			cell.textContent = '⚙';
			row.appendChild(cell);
		} else {
			row.textContent = '⚙';
		}

		return row;
	}

	static #renderHeaderCells(headers) {
		const cells = document.createDocumentFragment();

		for (const header of headers) {
			const cell = document.createElement('th');
			if (header) cell.textContent = _(header);
			cells.appendChild(cell);
		}

		return cells;
	}

	static createHeaderRow(headers) {
		const row = document.createElement('tr');
		row.appendChild(this.#renderHeaderCells(headers));
		return row;
	}

	static createTable(headers, rows) {
		const table = document.createElement('table');
		const tbody = document.createElement('tbody');
		tbody.appendChild(this.createHeaderRow(headers));

		for (const rowCells of rows) {
			const row = document.createElement('tr');

			for (const cellContent of rowCells) {
				const cell = document.createElement('td');
				this.appendContent(cell, cellContent);
				row.appendChild(cell);
			}

			tbody.appendChild(row);
		}

		table.appendChild(tbody);
		return table;
	}

	static appendContent(parent, content) {
		if (content == null || content === '&nbsp;') {
			parent.appendChild(document.createTextNode(TOKEN.EMPTY_TEXT));
			return parent;
		}

		if (Array.isArray(content)) {
			for (const item of content) TOKEN.appendContent(parent, item);
			return parent;
		}

		if (content instanceof Node) {
			parent.appendChild(content);
			return parent;
		}

		parent.appendChild(document.createTextNode(String(content)));
		return parent;
	}

	static replaceContent(parent, content) {
		parent.textContent = '';
		return this.appendContent(parent, content);
	}

	static createTextElement(tagName, text, className) {
		const element = document.createElement(tagName);
		if (className) element.className = className;
		element.textContent = text;
		return element;
	}

	static createMultilineContent(content) {
		const fragment = document.createDocumentFragment();
		if (content == null || content === '&nbsp;' || content === '') {
			fragment.appendChild(document.createTextNode(TOKEN.EMPTY_TEXT));
			return fragment;
		}

		String(content).split('\n').forEach((line, index) => {
			if (index) fragment.appendChild(document.createElement('br'));
			fragment.appendChild(document.createTextNode(line));
		});
		return fragment;
	}

	static createSelect(tid, cls, val, emptyOpt, opts, multiple) {
		const s = select(val, emptyOpt, opts, multiple);
		s.classList.add(...cls.split(/\s+/).filter(Boolean));  // Add multiple classes simultaneously
		if (tid != null && tid !== '') s.dataset.tid = tid;

		return s;
	}

	static createInput({type = 'text', name, value = '', placeholder, className = 'input', checked = false} = {}) {
		const input = document.createElement('input');
		input.type = type;
		input.className = className;
		if (name) input.name = name;
		if (value != null) input.value = value;
		if (placeholder != null) input.placeholder = _(placeholder);
		if (type === 'checkbox') input.checked = checked;
		return input;
	}

	static createTextarea({name, value = '', placeholder, className = 'input'} = {}) {
		const textarea = document.createElement('textarea');
		textarea.className = className;
		if (name) textarea.name = name;
		textarea.value = value || '';
		if (placeholder != null) textarea.placeholder = _(placeholder);
		return textarea;
	}

	static createCenter(...children) {
		const center = document.createElement('div');
		center.className = 'center';
		for (const child of children) TOKEN.appendContent(center, child);
		return center;
	}

	static createTokenTitle(label, value) {
		const title = document.createElement('h3');
		title.className = 'tkn';
		title.appendChild(document.createTextNode(`${_(label)}: `));
		const strong = document.createElement('strong');
		strong.textContent = value;
		title.appendChild(strong);
		return title;
	}

	static #appendTextWithReplacements(parent, text, replacements) {
		const parts = String(text).split(/(%[A-Za-z0-9_]+%)/g);
		for (const part of parts) {
			const match = part.match(/^%([A-Za-z0-9_]+)%$/);
			parent.appendChild(document.createTextNode(match && replacements?.[match[1]] != null
				? String(replacements[match[1]])
				: part));
		}
	}

	static #appendFormattedLocaleText(parent, txt, replacements) {
		const stack = [parent];
		for (const part of _(txt).split(/(<\/?b>)/i)) {
			if (!part) continue;
			const current = stack[stack.length - 1];
			if (part.toLowerCase() === '<b>') {
				const bold = document.createElement('b');
				current.appendChild(bold);
				stack.push(bold);
				continue;
			}
			if (part.toLowerCase() === '</b>') {
				if (stack.length > 1) stack.pop();
				continue;
			}
			TOKEN.#appendTextWithReplacements(current, part, replacements);
		}
	}

	static createLink(tid, cls, txt, replacements) {
		const a = document.createElement('a');
		a.href = '#';
		a.className = cls;
		if (tid != null && tid !== '') a.dataset.tid = tid;
		TOKEN.#appendFormattedLocaleText(a, txt, replacements);

		return a;
	}
}

TOKEN.initalize();
