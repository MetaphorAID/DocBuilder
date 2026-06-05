class TOKEN {
	static SEL_BOOL = {
		'True': 'True',
		'False': 'False',
	}

	static SEL_WHERE = {
		'0': 'Before',
		'1': 'After',
	}

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
		Locale['Insert Before <b>%word%</b>'] = 'Beszúrás <b>%word%</b> elé';
		Locale['Insert After <b>%word%</b>'] = 'Beszúrás <b>%word%</b> után';

		Locale['Split Token...'] = 'Token szétszed...';
		Locale['Move Sentence...'] = 'Mondat mozgat...';
		Locale['Join Sentence...'] = 'Mondat összevon...';
		Locale['Split Sentence...'] = 'Mondat szétszed...';

		Locale['Edit'] = 'Szerkeszt';
		Locale['Save'] = 'Elment';

		evt(editor.dom, 'document-loaded', function () {
			sel('#header').innerHTML = '';
			sel('#footer').innerHTML = '';

			// Add Normal/Table view swithcher button
			if (!sel('header .btn-view')) {
				const a = document.createElement('a');
				a.href = '#';
				a.className = 'btn btn-view';
				a.innerHTML = _(localStorage.tableview ? 'Normal View' : 'Table View');

				sel('header').appendChild(a);
			}
		});

		document.addEventListener('click', function (e) {
			const t = e.target;
			if (!t) return;

			// Change view
			if (t.matches('.btn-view')) {
				localStorage.tableview = localStorage.tableview ? '' : '1';
				sel('header .btn-view').innerHTML = _(localStorage.tableview ? 'Normal View' : 'Table View');
				editor.render(editor.getVisible());
			}
		});
	}

	static getSelect(tid, cls, val, emptyOpt, opts, multiple) {
		const s = select(val, emptyOpt, opts, multiple);
		s.className += ' ' + cls;
		if (tid) s.dataset.tid = tid;

		return s.outerHTML;
	}

	static getLink(tid, cls, txt, tpl) {
		const a = document.createElement('a');
		a.href = '#';
		a.className = cls;
		if (tid) a.dataset.tid = tid;
		a.innerHTML = tpl ? tpl.replace('@', _(txt)) : _(txt);

		return a.outerHTML;
	}
}

TOKEN.initalize();
