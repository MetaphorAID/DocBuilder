(function () {
	const TOKEN_STICKY = {
		'left': 'Sticks Left',
		'right': 'Sticks Right',
		'both': 'Sticks Both',
		'no': 'Does Not Stick'
	}

	const SENT_TYPE = {
		'B\u00e1nat': 'Bánat',
		'D\u00fch': 'Düh',
		'El\u00e9gedetlens\u00e9g': 'Elégedetlenség',
		'F\u00e9lelem': 'Félelem, Rémület (tartalmazza a Szorongást)',
		'G\u00fanyol\u00f3d\u00e1s': 'Gúnyolódás, Kifogásolás',
		'Irigys\u00e9g': 'Irigység, Féltékenység',
		'Undor': 'Undor, Megvetés',
		'Kellemetlens\u00e9g': 'Kellemetlenség',
		'Egy\u00fctt\u00e9rz\u00e9s': 'Együttérzés, Szimpátia',
		'\u00c9rdekl\u0151d\u00e9s': 'Érdeklődés (Interest)',
		'Nosztalgia': 'Nosztalgia',
		'Szokatlans\u00e1g': 'Szokatlanság, Meglepődés',
		'El\u00e9gedetts\u00e9g': 'Elégedettség',
		'\u00d6r\u00f6m': 'Öröm',
		'Rem\u00e9nyked\u00e9s': 'Reménykedés, Bizakodás, Vágyakozás'
	}

	const ANNOT_TYPE = {
		'Szem\u00e9lyn\u00e9v': 'Személynév',
		'Helyn\u00e9v': 'Helynév',
		'Int\u00e9zm\u00e9nyn\u00e9v': 'Intézménynév'
	}

	Locale['Detailed'] = 'Részletes';
	Locale['Simple'] = 'Egyszerű';
	Locale['Re-Analyze'] = 'Új elemzés';
	Locale['Select Ana.'] = 'Elemzés választása';
	Locale['No Selected Analyzation'] = 'Nincs kiválasztva elemzés';
	Locale['Type: Word'] = 'Típus: Szó';
	Locale['Type: Punct'] = 'Típus: Punkt.';
	Locale['Select Sentinence...'] = 'Érzelemtípus...';

	const _active = {};
	let _annots = {changed: false};

	function renderAnnots(_annots, x) {
		if (_annots.xml) {
			each('token', function (i) {
				const id = i.getAttribute('xml:id');
				if (!_annots.ref[id]) return;
				for (const j in _annots.ref[id]) {
					if (sel('[data-aid="' + j + '"]')) return;
					const annotEl = document.createElement('div');
					annotEl.dataset.aid = j;
					annotEl.className = 'annot';
					annotEl.innerHTML = _annots.list[j].getAttribute('entity') + ': ' + xmlToText(_annots.list[j].innerHTML);
					sel('#footer').appendChild(annotEl);
				}
			}, x);
		}
	}

	function removeAnnots(_annots, input) {
		if (_annots.xml) {
			each('token', function (i) {
				const id = i.getAttribute('xml:id');
				if (!_annots.ref[id]) return;
				for (let j in _annots.ref[id]) {
					j = sel('[data-aid="' + j + '"]');
					if (j) j.remove();
				}
			}, _active[input.dataset.cid]);
		}
	}

	Editor.TYPES.t_p = {
		remove: function (input, chunk) {
			removeAnnots(_annots, input);
			delete _active[input.dataset.cid];
		},
		getValue: function (input, chunk) {
			const cid = input.dataset.cid;
			return _active[cid]?.documentElement.outerHTML ?? chunk.value;
		},
		render: function (chunk, cid) {
			// Find the largest active chunk Id
			const currentId = editor.chunks[cid].id || 0;
			let previousId = 0;
			for (const activeCid in _active) previousId = Math.max(previousId, editor.chunks[activeCid].id || 0);

			// Find the current section heading
			let header = '';
			for (const hidden of editor.hidden) {
				const hiddenId = hidden.id || 0;

				if (hiddenId > currentId) break;
				if (hiddenId < previousId) continue;

				if (hidden.name === '.t_head') header = hidden.value;
			}

			// Parse the XML to paragraph format
			const x = parseXml(chunk.value);
			_active[Number(cid)] = x;
			const ep = parsePar(x);

			// Empty paragraph handling
			if (!ep.children.length) {
				ep.innerHTML = xmlToText(chunk.value) || '<em>' + _('EMPTY') + '</em>';
			} else {
				ep.classList.add('par', 'tei');
				renderAnnots(_annots, x);
			}

			// Add heading
			if (header) ep.innerHTML = '<h4>' + header + '</h4>' + ep.innerHTML;
			return ep;
		},
	}

	evt(editor.dom, 'change-hidden', function (e) {
		// Find the header
		// The value of hids is in e.detail
		for (const hid of e.detail) {
			const h = editor.hidden[hid];
			if (h.name === '.t_header') {
				let html = '';
				const x = parseXml(h.value);
				html = '<h2>' + selToText(x, 'title') + '</h2>'
					+ '<h3>' + selToText(x, 'author') + '</h3>' + html;
				sel('#header').innerHTML = html;
			}
			if (h.name === '.t_annotations') {
				_annots = {id: hid, xml: parseXml(h.value), list: [], ref: {}, changed: false}
				each('annotation', function (i, ii) {
					_annots.list.push(i);
					each('token', function (j) {
						const t = j.getAttribute('target');
						if (!_annots.ref[t]) _annots.ref[t] = {};
						_annots.ref[t][ii] = (j.previousElementSibling ? 0 : 1) + (j.nextElementSibling ? 0 : 2);
					}, i);
				}, _annots.xml);
				sel('#footer').innerHTML = '';
			}
		}
	});

	function getUID(xml, prefix) {
		// Find an exisiting Uniquie ID or generate one
		let n = 0;
		let id = `${prefix}_${++n}`;

		// Using namespace-aware CSS selector
		while (sel(`[*|id="${id}"]`, xml)) {
			id = `${prefix}_${++n}`;
		}

		return id;
	}

	function delNode(node) {
		const prev = node.previousSibling;
		if (prev?.nodeName === '#text') prev.remove();
	}

	function createConfigRow(tableView) {
		const row = document.createElement(tableView ? 'tr' : 'span');
		row.className = 'cfg';
		row.innerHTML = tableView ? '<td colspan="5" class="as-parent">⚙</td>' : '⚙';

		return row;
	}

	function renderToken(token, tid, tableView) {
		// Create word element
		const wordEl = document.createElement(tableView ? 'tr' : 'span');
		wordEl.className = 't';
		wordEl.dataset.tid = tid;

		// Add joins if needed
		const joinType = token.getAttribute('join') || '';
		if (['left', 'both'].includes(joinType)) wordEl.classList.add('left');
		if (['right', 'both'].includes(joinType)) wordEl.classList.add('right');

		// Construct tableView for word
		const word = sel('form', token);
		if (!word) return null;

		if (word.getAttribute('modified') === 'True') wordEl.classList.add(' modified');
		let morph = sel('morph', token);
		if (morph && morph.getAttribute('check') === 'False') {
			wordEl.classList.add(' unchecked');
			if (find('ana', morph).length === 1) wordEl.classList.add(' single');
		} else {
			morph = false;
		}

		if (tableView) {
			let et = document.createElement('td');
			et.innerHTML = word.innerHTML || '&nbsp;';
			et.className = 'as-parent';
			wordEl.appendChild(et);
			const ana = sel('ana[correct="True"]', token);
			et = document.createElement('td');
			et.className = 'as-parent';
			et.innerHTML = ana ? sel('lemma', ana).textContent : '&nbsp;';
			wordEl.appendChild(et);
			et = document.createElement('td');
			et.className = 'as-parent';
			et.innerHTML = ana ? sel('detailed', ana).textContent : '&nbsp;';
			wordEl.appendChild(et);
			et = document.createElement('td');
			et.className = 'as-parent';
			et.innerHTML = ana ? sel('simple', ana).textContent : '&nbsp;';
			wordEl.appendChild(et);
			et = document.createElement('td');
			if (morph && ana) {
				et.className = 'selAna';
				et.dataset.tid = tid;
				et.dataset.ana = 'default';
				et.innerHTML = '✓';
			} else {
				et.className = 'as-parent';
				et.innerHTML = '&nbsp;';
			}
			wordEl.appendChild(et);
		} else {
			wordEl.innerHTML = word.innerHTML || '&nbsp;';
		}
		return wordEl;
	}

	function renderSentence(sentence, sid, tableView) {
		// Create and setup sentence element
		let sentenceEl = document.createElement(tableView ? 'table' : 'div');
		sentenceEl.className = 's';
		sentenceEl.dataset.sid = sid;
		if (tableView) {
			sentenceEl.innerHTML = '<tbody><tr><th>' + _('Token') + '</th><th>' + _('Lemma') + '</th><th>' + _('Detailed')
				+ '</th><th>' + _('Simple') + '</th><th></th></tr></tbody>'
			// Change from <table> to <tbody>
			sentenceEl = sentenceEl.children[0];
		}
		// Put each token into the sentence element
		each('token', (token, tid) => {
			const renderedToken = renderToken(token, tid, tableView);

			if (renderedToken)
				sentenceEl.appendChild(renderedToken);
		}, sentence);

		// Create the config row for the sentence
		const row = createConfigRow(tableView);
		if (!sentence.getAttribute('sent')) row.classList.add(' unchecked');
		sentenceEl.appendChild(row);

		return tableView ? sentenceEl.parentNode : sentenceEl;
	}

	function parsePar(dom) {
		// Create paragraph element
		const tableView = localStorage.tableview;
		const root = document.createElement('div');
		if (tableView) root.className = 'table';

		// Put sentences into the paragraph element
		each('s,l', (sentence, sid) => root.appendChild(renderSentence(sentence, sid, tableView)), dom);
		return root;
	}

	function savePar(cids) {
		const hdata = {};
		if (_annots.changed) {
			hdata[_annots.id] = _annots.xml.documentElement.outerHTML;
			_annots.changed = false;
		}
		editor.onchange(cids, hdata);
	}

	function updAnnot(from, to) {
		if (!_annots.xml) return;
		const t1 = to[0].getAttribute('xml:id');
		each('[target="' + from.join('"],[target="') + '"]', function (i) {
			_annots.changed = true;
			const a = i.closest('annotation');
			if (!sel('[target="' + t1 + '"]', a) || t1 === i.getAttribute('target')) {
				for (let t in to) {
					t = to[t];
					const d = _annots.xml.createElement('token');
					d.setAttribute('target', t.getAttribute('xml:id'));
					d.textContent = sel('form', t).textContent;
					a.insertBefore(d, i);
				}
			}
			i.remove();
		}, _annots.xml);
	}

	function updJoin(tid, xtl) {
		const l = tid > 0 && ['right', 'both'].indexOf(xtl[tid - 1].getAttribute('join')) !== -1;
		const r = tid < xtl.length - 1 && ['left', 'both'].indexOf(xtl[tid + 1].getAttribute('join')) !== -1;
		xtl[tid].setAttribute('join', l ? (r ? 'both' : 'left') : (r ? 'right' : 'no'));
	}

	function updAna(tokens, cid) {
		const token = tokens.shift();
		const formData = new FormData();
		formData.append('file', new Blob(['form\n' + sel('form', token).textContent + '\n'], {type: 'text/plain'}),
			'input.txt');
		fetch('https://emtsv.elte-dh.hu/morph', {
			method: 'POST',
			body: formData
		}).then(r => r.text()).then(function (data) {
			data = data.replace(/^[^\r\n]*[\r\n]+[^\t]*\t/, '');
			data = JSON.parse(data);
			const morph = sel('morph', token);
			each('ana', i => {
				delNode(i);
			}, morph);
			const tpl = sel('ana', _active[cid]);
			for (let d in data) {
				d = data[d];
				const ana = parseXml(tpl.outerHTML).documentElement;
				ana.setAttribute('correct', 'False');
				sel('lemma', ana).textContent = d.lemma;
				sel('detailed', ana).textContent = d.readable;
				sel('simple', ana).textContent = d.tag;
				morph.appendChild(ana);
				if (ana.previousSibling && ana.previousSibling.nodeName === '#text') {
					morph.appendChild(ana.previousSibling);
				}
				if (tpl.previousSibling && tpl.previousSibling.nodeName === '#text') {
					morph.insertBefore(_active[cid].createTextNode(tpl.previousSibling.textContent), ana);
				}
			}
			morph.setAttribute('check', 'False');
			if (tokens.length) {
				updAna(tokens, cid);
			} else {
				savePar([cid]);
			}
		});
	}

	function resolveParagraphContext(target) {
		// Only handle events within paragraph containers
		const paragraph = target.closest('.par.tei');
		if (!paragraph) return null;

		const paragraphId = Number(paragraph.dataset.cid);
		const paragraphXml = _active[paragraphId];

		if (!paragraphXml) return null;

		return {paragraph, paragraphId, paragraphXml};
	}

	function resolveTokenContext(target, paragraphCtx, resolveTableCellParent = false) {

		// In table view the click lands on a <td class="as-parent">, while the
		// token class and data-tid live on its parent <tr>. Both nodes have the
		// same .s ancestor, so this normalization is needed for token lookup,
		// not for resolving the sentence.
		if (resolveTableCellParent && localStorage.tableview && target.classList.contains('as-parent'))
			target = target.parentNode;

		// Only handle events on elements inside sentences (.s)
		const sentence = target.closest('.s');
		if (!sentence) return null;

		const sentenceId = Number(sentence.dataset.sid);
		const sentences = find('s,l', paragraphCtx.paragraphXml);
		const sentenceXml = sentences[sentenceId];

		if (!sentenceXml) return null;

		const tokenId = target.dataset.tid;
		const tokens = find('token', sentenceXml);
		const tokenXml = tokenId ? tokens[Number(tokenId)] : null;

		return {
			...paragraphCtx,
			target,
			sentence,
			sentenceId,
			sentenceXml,
			tokens,
			tokenId,
			tokenXml
		};
	}

	function resolveChangeValue(target) {
		let value = target.dataset.value ?? target.value;

		if (target.classList.contains('multiple')) {
			try {
				value = JSON.parse(target.dataset.value);
			} catch {
				value = null;
			}
		}

		if (value === '') return null;

		return value;
	}

	function resolveContext(target, {includeValue = false, resolveTableCellParent = false} = {}) {
		const paragraphCtx = resolveParagraphContext(target);
		if (!paragraphCtx) return null;

		const tokenCtx = resolveTokenContext(target, paragraphCtx, resolveTableCellParent);
		if (!tokenCtx) return null;

		if (!includeValue) return tokenCtx;

		const value = resolveChangeValue(target);
		if (value == null) return null;

		return {...tokenCtx, value};
	}

	function handleTokenContextMenu(e, target, tokenXml, tokenId, sentence, tokens) {
		// Clear active
		each('.par .active', i => i.classList.remove('active'));

		let html = '';
		if (tokenXml) { // Token
			// Set the current tooltip active
			target.classList.add('active');

			// Setup elements
			if (sel('morph', tokenXml)) html += TOKEN.getLink(tokenId, 'edit ana', 'Select Ana.');
			if (_annots.xml) {
				html += TOKEN.getSelect(tokenId, 'add annot', '', 'New Annotation...', ANNOT_TYPE);
				const addIfHas = (lst, label) => {
					if (Object.keys(lst).length) html += TOKEN.getSelect(tokenId, label.key, '', label.text, lst);
				};

				const buildList = (items, filterFn, prefix = '') => {
					const lst = {};
					for (const i in items || {}) {
						if (!filterFn(items[i])) continue;
						lst[prefix + i] = xmlToText(_annots.list[i].innerHTML);
					}
					return lst;
				};

				// Annotations containing the token
				const currentId = tokenXml.getAttribute('xml:id');
				addIfHas(buildList(_annots.ref[currentId], v => v !== 0),
					{key: 'delfrom annot', text: 'Delete From Annotation...'});

				// Annotations next to the token
				const prev = tokenId > 0 ?
					buildList(_annots.ref[tokens[Number(tokenId) - 1].getAttribute('xml:id')], v => (v & 2) !== 0, 'L') : {};

				const next = tokenId < tokens.length - 1 ?
					buildList(_annots.ref[tokens[Number(tokenId) + 1].getAttribute('xml:id')], v => (v & 1) !== 0, 'F') : {};

				const merged = {...prev, ...next};

				addIfHas(merged, {key: 'addto annot', text: 'Add To Annotation...'});
			}
			html += TOKEN.getSelect(tokenId, 'edit sticky', tokenXml.getAttribute('join') || '?', 'Sticks To...',
				TOKEN_STICKY);

			// Setup possible token splittings
			const tkn = selToText(tokenXml, 'form', true);
			if (tkn.length > 1) {
				const split = {};
				for (let i = 1; i < tkn.length; ++i) split[i] = encXml(tkn.slice(0, i)) + ' | ' + encXml(tkn.slice(i));
				html += TOKEN.getSelect(tokenId, 'split token', '', 'Split Token...', split);
			}
			// Setup other elements
			//html += TOKEN.getSelect(tid, 'edit tokentype', xt.nodeName, '', { w: 'Type: Word', pc: 'Type: Punct' });
			html += TOKEN.getLink(tokenId, 'edit token', 'Fix Token'); // Change the value freely
			html += TOKEN.getSelect(tokenId, 'join token', '', 'Join Token...', TOKEN.SEL_WHERE);
			html += TOKEN.getLink(tokenId, 'ins token', 'Insert Token');
			html += TOKEN.getLink(tokenId, 'del token', 'Delete Token');
			html += TOKEN.getSelect(tokenId, 'split sent', '', 'Split Sentence...', TOKEN.SEL_WHERE);
		} else {
			// Setup elements for non-tokens (punctuations?)
			sentence.classList.add('active');
			html += TOKEN.getSelect(tokenId, 'edit sent', (sentenceXml.getAttribute('sent') || '').split(';'),
				'Select Sentinence...', SENT_TYPE, true);
			html += TOKEN.getSelect(tokenId, 'join sent', '', 'Join Sentence...', TOKEN.SEL_WHERE);
			html += TOKEN.getSelect(tokenId, 'move sent', '', 'Move Sentence...', TOKEN.SEL_WHERE);
		}

		// Show the tooltip a dropdown menu
		const tt = ttip(target, e);
		tt.classList.add('dropdown');
		tt.innerHTML = html;
	}

	function handleEditAna(e, target, tokenXml, tokenId, sentence) {
		const form = selToText(tokenXml, 'form');
		const row = (cols, btnHtml = '') => `<tr><td>${cols.join('</td><td>')}</td><td>${btnHtml}</td></tr>`;
		const btn = (tid, anaId = '', selected = false) =>
			`<a href="#" data-tid="${tid}" data-ana="${anaId}" class="btn selAna ${selected ? 'selected' : ''}">✓</a>`;

		let html = `<h3 class="tkn">${_('Token')}: <strong>${form}</strong></h3><table><tr><th>${_('Lemma')}</th>
				<th>${_('Detailed')}</th><th>${_('Simple')}</th><th></th></tr>`;

		// Existing analyses
		each('ana', (i, ii) => {
			if (i.getAttribute('modified') === 'True') return;
			html += row([selToText(i, 'lemma'), selToText(i, 'detailed'), selToText(i, 'simple')],
				btn(tokenId, ii, i.getAttribute('correct') === 'True'));
		}, tokenXml);

		// Modified / Editable ana
		const ana = sel('ana[modified="True"]', tokenXml);
		html += row([
			`<input class="input" type="text" value="${ana ? selToText(ana, 'lemma') : ''}">`,
			`<input class="input" type="text" value="${ana ? selToText(ana, 'detailed') : ''}">`,
			`<input class="input" type="text" value="${ana ? selToText(ana, 'simple') : ''}">`
		], btn(tokenId, '', !!ana));

		html += `</table><div class="center">${TOKEN.getLink(tokenId, 'btn ana fetch', 'Re-Analyze')
		}${TOKEN.getLink(tokenId, 'btn ana save', 'Save')}</div>`;

		const tt = ttip(sel('.cfg', sentence), e, true);
		tt.innerHTML += html;

		evt('table input', 'focus', function () {
			trg('.btn', 'click', this.closest('tr'));
		}, tt);
	}

	function handleSelAna(target, tokenXml, paragraphId) {
		// If default
		if (target.dataset.ana === 'default') {

			// Set correct attribute False
			each('ana[correct="True"]', (i, idx) => {
				if (idx) i.setAttribute('correct', 'False');
			});

			// Set check attribute True
			sel('morph', tokenXml)?.setAttribute('check', 'True');
			savePar([paragraphId]);
			return;
		}

		// Clear correct
		each('ana', i => i.setAttribute('correct', 'False'), tokenXml);

		// Remove existing selected
		target.closest('table').querySelectorAll('.btn.selAna').forEach(b => b.classList.remove('selected'));

		// Add the new selected
		target.classList.add('selected');

		// Set Correct attribute in XML
		const anaIndex = target.dataset.ana;
		if (anaIndex != null) find('ana', tokenXml)[anaIndex]?.setAttribute('correct', 'True');
	}

	function handleSaveAna(target, tokenXml, paragraphXml, paragraphId) {
		const morph = sel('morph', tokenXml);
		const tooltip = target.closest('.tooltip');

		// Remove modified ana if present
		const mod = sel('ana[modified="True"]', morph);
		if (mod) delNode(mod);

		// If nothing is marked correct → we must create one
		if (!sel('ana[correct="True"]', morph)) {
			let selected = sel('.selAna.selected', tooltip);
			if (!selected) return addMsg(_('No Selected Analyzation'), null, tooltip);

			const inputs = find('input', selected.closest('tr'));
			const vals = inputs.map(i => i.value.trim());
			if (!vals[0] || vals[0].includes(' ')) return addMsg(_('Invalid Format'), null, inputs[0]);

			// if (vals[1].length && !vals[1].match(/^\S+\[\/\S+\](=\S+)?(\s+\+\s+\S*\[[^\]]+\](=\S+)?)*$/))
			// 	return addMsg(_('Invalid Format'), null, inputs[1]);
			//
			// if (!vals[2].length || !vals[2].match(/^\[\/\S+\](\[[^\]]+\])*$/))
			// 	return addMsg(_('Invalid Format'), null, inputs[2]);

			const tpl = sel('ana', paragraphXml);
			const ana = parseXml(tpl.outerHTML).documentElement;
			ana.setAttribute('correct', 'True');
			ana.setAttribute('modified', 'True');

			['lemma', 'detailed', 'simple'].forEach((tag, i) => sel(tag, ana).textContent = vals[i]);
			morph.appendChild(ana);

			// Preserve whitespace nodes (cleaner grouping)
			if (tpl.previousSibling?.nodeType === 3)
				morph.insertBefore(paragraphXml.createTextNode(tpl.previousSibling.textContent), ana);
		}

		morph.setAttribute('check', 'True');
		savePar([paragraphId]);
	}

	function handleEditToken(e, sentence, tokenXml) {
		const html = `<input type="text" class="input" value="${selToText(tokenXml, 'form')}"><div class="center">${
			TOKEN.getLink(tokenId, 'btn token save', 'Save')}</div>`;

		ttip(sel('.cfg', sentence), e, true).innerHTML += html;
	}

	function handleSaveToken(target, tokenXml, paragraphId) {
		const tooltip = target.closest('.tooltip');
		const input = sel('input', tooltip);
		const tkn = sel('form', tokenXml);
		const val = input.value.trim();

		// No change → just close
		if (tkn.textContent === val) return trg(tooltip, 'close');

		// Validation
		if (!val || val.includes(' ')) return addMsg(_('Invalid Format'), null, input);
		tkn.setAttribute('modified', 'True');
		tkn.textContent = val;

		const morph = sel('morph', tokenXml);
		if (morph) {
			morph.setAttribute('check', 'False');
			morph.innerHTML = '';
		}

		updAna([tokenXml], paragraphId);
	}

	function handleInsertToken(e, tokenXml, tokenId, sentence) {
		const tt = ttip(sel('.cfg', sentence), e, true);
		const form = selToText(tokenXml, 'form');
		tt.innerHTML += `<input type="text" class="input" value=""><div class="center">${
			TOKEN.getLink(tokenId, 'btn token ins2 left', `Insert Before <b>${form}</b>`)}${
			TOKEN.getLink(tokenId, 'btn token ins2 right', `Insert After <b>${form}</b>`)}</div>`;
	}

	function handleSaveInsertedToken(target, tokenXml, sentenceXml, paragraphXml, paragraphId) {
		// Get the new token and validate it
		const input = sel('input', target.closest('.tooltip'));
		const value = input.value.trim();

		// Validation
		if (!value || value.includes(' ')) return addMsg(_('Invalid Format'), null, input);

		// Clone the original token XML
		const newTokenXml = parseXml(tokenXml.outerHTML).documentElement;

		// Create new unique ID, store value and note modified status
		const baseId = tokenXml.getAttribute('xml:id').split('_')[0];
		newTokenXml.setAttribute('xml:id', getUID(paragraphXml, baseId));

		const token = sel('form', newTokenXml);
		token.textContent = value;
		token.setAttribute('modified', 'True');

		const morph = sel('morph', newTokenXml);
		if (morph) {
			morph.setAttribute('check', 'False');
			morph.innerHTML = '';
		}

		// Determine the insertion point
		const insertBefore = target.classList.contains('left');
		const referenceNode = insertBefore ? tokenXml : tokenXml.nextSibling;
		// Preserve whitespace
		const previousText = tokenXml.previousSibling?.nodeName === '#text' ? tokenXml.previousSibling.textContent : '';
		// Insert the new token and reinsert the whitespace
		sentenceXml.insertBefore(newTokenXml, referenceNode);
		if (previousText) sentenceXml.insertBefore(paragraphXml.createTextNode(previousText), referenceNode);
		// Save changes and refress the UI
		updAna([newTokenXml], paragraphId);
	}

	document.addEventListener('click', e => {
		let target = e.target;
		if (!target) return;

		const ctx = resolveContext(target, {resolveTableCellParent: true});
		if (!ctx) return;

		// Open tooltip
		if (ctx.target.matches('.t, .cfg'))
			return handleTokenContextMenu(e, ctx.target, ctx.tokenXml, ctx.tokenId, ctx.sentence, ctx.tokens);

		if (ctx.target.matches('.edit.ana')) return handleEditAna(e, ctx.target, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (ctx.target.matches('.selAna')) return handleSelAna(ctx.target, ctx.tokenXml, ctx.paragraphId);

		if (ctx.target.matches('.save.ana'))
			return handleSaveAna(ctx.target, ctx.tokenXml, ctx.paragraphXml, ctx.paragraphId);

		if (ctx.target.matches('.fetch.ana')) return updAna([ctx.tokenXml], ctx.paragraphId);

		if (ctx.target.matches('.edit.token')) return handleEditToken(e, ctx.sentence, ctx.tokenXml);

		if (ctx.target.matches('.save.token')) return handleSaveToken(ctx.target, ctx.tokenXml, ctx.paragraphId);

		if (ctx.target.matches('.ins.token')) return handleInsertToken(e, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (ctx.target.matches('.ins2.token'))
			return handleSaveInsertedToken(ctx.target, ctx.tokenXml, ctx.sentenceXml,ctx. paragraphXml, ctx.paragraphId);

		if (ctx.target.matches('.del.token')) {
			const id = ctx.tokenXml.getAttribute('xml:id');
			delNode(ctx.tokenXml);
			updAnnot([id], []);
			savePar([ctx.paragraphId]);
		}

	});

	document.addEventListener('change', e => {
		const target = e.target;
		if (!target) return;

		const ctx = resolveContext(target, {includeValue: true});
		if (!ctx) return;

		// Sentence stuff
		if (target.matches('.edit.sent')) {
			value = value.join(';');
			if ((sentenceXml.getAttribute('sent') || '') === value) return;
			sentenceXml.setAttribute('sent', value);
			savePar([paragraphId]);
			return;
		}

		if (target.matches('.split.sent')) {
			if (value === '') return;
			const xt2 = tokens[Number(tokenId) + (value === '0' ? 0 : 1)];
			if (!xt2 || xt2 === tokens[0]) {
				addMsg(_('Invalid Action'));
				return;
			}
			const indent = sentenceXml.previousSibling && sentenceXml.previousSibling.nodeName === '#text' ? sentenceXml.previousSibling.textContent : '';
			sentenceXml.setAttribute('modified', 'True');
			sentenceXml.insertBefore(paragraphXml.createElement('split'), xt2);
			const xe = paragraphXml.documentElement;
			const id = sentenceXml.getAttribute('xml:id').split('_')[0];
			xe.innerHTML = xe.innerHTML.replace(/([ \t\r\n]*)<split[^>]*>/
				, indent + '</' + sentenceXml.nodeName + '>' + indent + '<' + sentenceXml.nodeName
				+ (id ? ' xml:id="' + getUID(paragraphXml, id) + '"' : '') + ' modified="True"> $1');
			savePar([paragraphId]);
			return;
		}

		if (target.matches('.join.sent')) {
			if (value === '') return;
			const off = value === '0' ? -1 : 1;
			let u, cids;
			if (sentences[sentenceId + off]) {
				u = off > 0 ? [sentenceXml, sentences[sentenceId + off]] : [sentences[sentenceId + off], sentenceXml];
				cids = [paragraphId];
			} else {
				if (!_active[paragraphId + off]) {
					const e = editor.renderChunk(paragraphId + off);
					if (e) paragraph.parentNode.insertBefore(e, off > 0 ? paragraph.nextSibling : paragraph);
				}
				if (!_active[paragraphId + off]) {
					addMsg(_('Invalid Action'));
					return;
				}
				u = off > 0 ? [sentenceXml, sel('s', _active[paragraphId + off])] : [sel('s:last-of-type', _active[paragraphId + off]), sentenceXml];
				cids = off > 0 ? [paragraphId, paragraphId + off] : [paragraphId + off, paragraphId];
			}
			if (!u[0] || !u[1]) {
				addMsg(_('Invalid Action'));
				return;
			}
			u[0].setAttribute('modified', 'True');
			u[0].innerHTML = u[0].innerHTML.replace(/[ \r\n\t]+$/, '') + u[1].innerHTML;
			const id2 = u[1].getAttribute('xml:id').split('_');
			delNode(u[1]);
			const id1 = u[0].getAttribute('xml:id').split('_');
			if (id1.length > 1) {
				if (id2.length > 1) {
					u[0].setAttribute('xml:id', '');
					u[0].setAttribute('xml:id', getUID(paragraphXml, id1[0]));
				} else {
					u[0].setAttribute('xml:id', id2[0]);
				}
			}
			savePar(cids);
			return;
		}

		if (target.matches('.move.sent')) {
			if (value === '') return;
			const off = value === '0' ? -1 : 1;
			if (!_active[paragraphId + off]) {
				const e = editor.renderChunk(paragraphId + off);
				if (e) paragraph.parentNode.insertBefore(e, off > 0 ? paragraph.nextSibling : paragraph);
			}
			if (!_active[paragraphId + off] || (off > 0 && sentences.length > sentenceId + 1) || (off < 0 && sentenceId > 0)) {
				addMsg(_('Invalid Action'));
				return;
			}
			const x2 = _active[paragraphId + off].documentElement
			if (off > 0) {
				x2.innerHTML = x2.innerHTML.replace(/([ \t\r\n]*)</, '$1' + sentenceXml.outerHTML + '$1<');
			} else {
				const indent = sentenceXml.previousSibling && sentenceXml.previousSibling.nodeName === '#text' ? sentenceXml.previousSibling.textContent : '';
				x2.innerHTML = x2.innerHTML.replace(/([ \t\r\n]*)$/, indent + sentenceXml.outerHTML + '$1');
			}
			delNode(sentenceXml);
			savePar(off > 0 ? [paragraphId, paragraphId + off] : [paragraphId + off, paragraphId]);
			return;
		}

		// Token stuff
		if (target.matches('.edit.sticky')) {
			tokenId = Number(tokenId);
			tokenXml.setAttribute('join', value);
			if (tokenId > 0) updJoin(tokenId - 1, tokens);
			if (tokenId < tokens.length - 1) updJoin(tokenId + 1, tokens);
			savePar([paragraphId]);
			return;
		}

		if (target.matches('.join.token')) {
			if (value === '') return;
			const off = value === '0' ? -1 : 1;
			const xt2 = tokens[Number(tokenId) + off];
			if (!xt2) {
				addMsg(_('Invalid Action'));
				return;
			}
			const u = off > 0 ? [tokenXml, xt2] : [xt2, tokenXml];
			let xml = '<form modified="True">' + selToText(u[0], 'form') + selToText(u[1], 'form') + '</form>';
			if (sel('morph', u[0]) || sel('morph', u[1])) xml += '<morph check="False"/>';
			const id2 = u[1].getAttribute('xml:id').split('_');
			delNode(u[1]);
			u[0].innerHTML = xml;
			const id1 = u[0].getAttribute('xml:id').split('_');
			if (id1.length > 1) {
				if (id2.length > 1) {
					u[0].setAttribute('xml:id', '');
					u[0].setAttribute('xml:id', getUID(paragraphXml, id1[0]));
				} else {
					u[0].setAttribute('xml:id', id2[0]);
				}
			}
			updAnnot([id1.join('_'), id2.join('_')], [u[0]]);
			updAna([u[0]], paragraphId);
			return;
		}

		if (target.matches('.split.token')) {
			if (value === '') return;
			const tkn = sel('form', tokenXml);
			tkn.setAttribute('modified', 'True');
			const morph = sel('morph', tokenXml);
			if (morph) {
				morph.setAttribute('check', 'False');
				morph.innerHTML = '';
			}
			const xt2 = parseXml(tokenXml.outerHTML).documentElement;
			sel('form', xt2).textContent = tkn.innerHTML.slice(value);
			const id1 = tokenXml.getAttribute('xml:id');
			if (id1) xt2.setAttribute('xml:id', getUID(paragraphXml, id1.split('_')[0]));
			tkn.textContent = tkn.textContent.slice(0, value);
			sentenceXml.insertBefore(xt2, tokenXml.nextSibling);
			if (tokenXml.previousSibling && tokenXml.previousSibling.nodeName === '#text') {
				sentenceXml.insertBefore(paragraphXml.createTextNode(tokenXml.previousSibling.textContent), tokenXml.nextSibling);
			}
			updAnnot([id1], [tokenXml, xt2]);
			updAna([tokenXml, xt2], paragraphId);
			return;
		}

		// if (t.matches('.edit.tokentype')) {
		// 	if (val == '' || val == xt.nodeName) return;
		// 	const xt2 = x.createElement(val);
		// 	xt2.innerHTML = xt.innerHTML;
		// 	sel('form', xt2).setAttribute('modified', 'True');
		// 	const id = x.documentElement.getAttribute('xml:id');
		// 	if (id) {
		// 		xt2.setAttribute('xml:id', getUID(x, val + id));
		// 		updAnnot([xt.getAttribute('xml:id')], [xt2]);
		// 	}
		// 	xs.insertBefore(xt2, xt);
		// 	xt.remove();
		// 	savePar([cid]);
		// 	return;
		// }

		// annotation stuff

		if (target.matches('.add.annot')) {
			if (value === '' || !_annots.xml) return;
			const i = _annots.xml.createElement(tokenXml.nodeName);
			i.setAttribute('target', tokenXml.getAttribute('xml:id'));
			i.textContent = sel('form', tokenXml).textContent;
			const a = _annots.xml.createElement('annotation');
			a.setAttribute('entity', value);
			a.appendChild(i);
			//TODO: sort?
			_annots.xml.documentElement.appendChild(a);
			_annots.changed = true;
			savePar();
			return;
		}

		if (target.matches('.addto.annot')) {
			if (value === '' || !_annots.xml) return;
			const an = _annots.list[value.slice(1)];
			const i = _annots.xml.createElement(tokenXml.nodeName);
			i.setAttribute('target', tokenXml.getAttribute('xml:id'));
			i.textContent = sel('form', tokenXml).textContent;
			an.insertBefore(i, value[0] === 'F' ? an.children[0] : null);
			_annots.changed = true;
			savePar();
			return;
		}

		if (target.matches('.delfrom.annot')) {
			if (value === '' || !_annots.xml) return;
			const an = _annots.list[value];
			sel('[target="' + tokenXml.getAttribute('xml:id') + '"]', an).remove();
			if (!sel('[target]', an)) an.remove();
			_annots.changed = true;
			savePar();
		}

	});

})();
