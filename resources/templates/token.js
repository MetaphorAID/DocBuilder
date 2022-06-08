var TOKEN = (function () {

	Locale['EMPTY'] = 'ÜRES';
	Locale['Sticks To...'] = 'Ragadás...';
	Locale['Sticks Left'] = 'Balra ragad';
	Locale['Sticks Right'] = 'Jobbra ragad';
	Locale['Sticks Both'] = 'Mindkettőre ragad';
	Locale['Does Not Stick'] = 'Nem ragad';

	Locale['Save'] = 'Elment';
	Locale['Detailed'] = 'Részletes';
	Locale['Simple'] = 'Egyszerű';
	Locale['Re-Analyze'] = 'Új elemzés';
	Locale['Select Ana.'] = 'Elemzés választása';
	Locale['No Selected Analyzation'] = 'Nincs kiválasztva elemzés';
	Locale['Fix Token'] = 'Token javítása';
	Locale['Delete Token'] = 'Token törlése';
	Locale['Insert Token'] = 'Token beszúrása';
	Locale['Insert Before <b>%word%</b>'] = 'Beszúrás <b>%word%</b> elé';
	Locale['Insert After <b>%word%</b>'] = 'Beszúrás <b>%word%</b> után';
	Locale['Join Token...'] = 'Token összevon...';
	Locale['Split Token...'] = 'Token szétszed...';
	Locale['Type: Word'] = 'Típus: Szó';
	Locale['Type: Punct'] = 'Típus: Punkt.';

	Locale['Select Sentinence...'] = 'Érzelemtípus...';
	Locale['Move Sentence...'] = 'Mondat mozgat...';
	Locale['Join Sentence...'] = 'Mondat összevon...';
	Locale['Split Sentence...'] = 'Mondat szétszed...';
	Locale['Before'] = 'Előtte';
	Locale['After'] = 'Utána';

	Locale['Invalid Action'] = 'Nem végrehajtható akció';
	Locale['Invalid Format'] = 'Hibás formátum';

	evt(editor.dom, 'load', function () {
		sel('#header').innerHTML = '';
		sel('#footer').innerHTML = '';

		if (!sel('header .btn-view')) {
			var a = document.createElement('a');
			a.href = '#';
			a.className = 'btn btn-view';
			a.innerHTML = _(localStorage.tableview ? 'Normal View' : 'Table View');
			sel('header').appendChild(a);
		}
	});

	document.addEventListener('click', function (e) {
		var t = e.target;
		if (!t) return;

		// change view
		if (t.matches('.btn-view')) {
			localStorage.tableview = localStorage.tableview ? '' : '1';
			sel('header .btn-view').innerHTML = _(localStorage.tableview ? 'Normal View' : 'Table View');
			editor.render(editor.getVisible());
			return;
		}
	});

	return {
		getSelect: function (tid, cls, val, empty_opt, opts, multiple) {
			var s = select(val, empty_opt, opts, multiple);
			s.className += ' ' + cls;
			if (tid) s.dataset.tid = tid;
			return s.outerHTML;
		},

		getLink: function (tid, cls, txt, tpl) {
			return '<a href="#" class="' + cls + '"' + (tid ? ' data-tid="' + tid + '"' : '') + '>' + (tpl ? tpl.replace('@', _(txt)) : _(txt)) + '</a>';
		}
	}

})();

