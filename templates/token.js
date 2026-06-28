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
		// and let TOKEN.getLink() substitute the runtime token text after `_()`
		Locale['Insert Before <b>%word%</b>'] = 'Beszúrás <b>%word%</b> elé';
		Locale['Insert After <b>%word%</b>'] = 'Beszúrás <b>%word%</b> után';

		Locale['Split Token...'] = 'Token szétszed...';
		Locale['Move Sentence...'] = 'Mondat mozgat...';
		Locale['Join Sentence...'] = 'Mondat összevon...';
		Locale['Split Sentence...'] = 'Mondat szétszed...';

		Locale['Edit'] = 'Szerkeszt';
		Locale['Save'] = 'Elment';

		evt(editor.dom, 'document-before-render', () => {
			sel('#header').innerHTML = '';
			sel('#footer').innerHTML = '';
			sel('header .btn-view')?.remove();
		});

		evt(editor.dom, 'document-ready', () => {
			// Add Normal/Table view swithcher button
			if (!sel('header .btn-view')) {
				const a = document.createElement('a');
				a.href = '#';
				a.className = 'btn btn-view';
				a.innerHTML = _(localStorage.tableview ? 'Normal View' : 'Table View');

				sel('header').appendChild(a);
			}
		});

		document.addEventListener('click', (e) => {
			const t = e.target;
			if (!t) return;

			// Change view
			if (t.matches('.btn-view')) {
				localStorage.tableview = localStorage.tableview ? '' : '1';
				sel('header .btn-view').innerHTML = _(localStorage.tableview ? 'Normal View' : 'Table View');
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
				cell.innerHTML = cellContent;
				row.appendChild(cell);
			}

			tbody.appendChild(row);
		}

		table.appendChild(tbody);
		return table;
	}

	static getSelect(tid, cls, val, emptyOpt, opts, multiple) {
		const s = select(val, emptyOpt, opts, multiple);
		s.classList.add(...cls.split(/\s+/));  // Add multiple classes simultaneously
		if (tid) s.dataset.tid = tid;

		return s.outerHTML;
	}

	static #formatLocaleText(txt, replacements) {
		let text = _(txt);
		for (const [key, value] of Object.entries(replacements || {})) {
			text = text.split(`%${key}%`).join(String(value));
		}
		return text;
	}

	static getLink(tid, cls, txt, tpl, replacements) {
		const a = document.createElement('a');
		a.href = '#';
		a.className = cls;
		if (tid) a.dataset.tid = tid;
		const label = TOKEN.#formatLocaleText(txt, replacements);
		// tpl is optional wrapper markup around the link text, for example '<b>@</b>'
		// Replace its @ placeholder with the localized label before assigning innerHTML
		a.innerHTML = tpl ? tpl.replace('@', label) : label;

		return a.outerHTML;
	}
}

TOKEN.initalize();
