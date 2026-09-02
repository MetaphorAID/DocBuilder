(function () {
	const EMTSV_URL = 'https://emtsv.elte-dh.hu/morph'; // TODO set as the metaphora API URL

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

	function renderAnnots(_annots, x) {
		// Create and display annotation elements associated with XML tokens
		if (!_annots.xml) return;
		each('token', token => {
			const id = token.getAttribute('xml:id');
			const refs = _annots.ref[id];
			if (!refs) return;

			for (const aid of Object.keys(refs)) {
				if (sel(`[data-aid="${aid}"]`)) continue;  // Already rendered

				const annot = _annots.list[aid];
				const annotEl = document.createElement('div');

				annotEl.dataset.aid = aid;
				annotEl.className = 'annot';
				annotEl.textContent = `${annot.getAttribute('entity')}: ${xmlToText(annot.innerHTML, true)}`;
				sel('#footer').appendChild(annotEl);
			}
		}, x);
	}

	function removeAnnots(_annots, input) {
		// Removes annotation elements from the DOM for the current active token
		if (!_annots.xml) return;
		each('token', token => {
			const id = token.getAttribute('xml:id');
			const refs = _annots.ref[id];
			if (!refs) return;

			for (const aid of Object.keys(refs)) sel(`[data-aid="${aid}"]`)?.remove();
		}, _active[input.dataset.cid]);
	}

	const _active = {};
	let _annots = {changed: false};

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
				const content = xmlToText(chunk.value, true);
				if (content) {
					ep.textContent = content;
				} else {
					ep.appendChild(TOKEN.createTextElement('em', _('EMPTY')));
				}
			} else {
				ep.classList.add('par', 'tei');
				renderAnnots(_annots, x);
			}

			// Add heading
			if (header) ep.prepend(TOKEN.createTextElement('h4', xmlToText(header, true) || header));
			return ep;
		},
	}

	evt(editor.dom, 'change-hidden', e => {
		// Find the header
		// The value of hids is in e.detail
		for (const hid of e.detail) {
			const headerChunk = editor.hidden[hid];
			if (headerChunk.name === '.t_header') {
				const headerChunkValueEl = parseXml(headerChunk.value);
				const header = sel('#header');
				header.replaceChildren(
					TOKEN.createTextElement('h2', selToText(headerChunkValueEl, 'title', true)),
					TOKEN.createTextElement('h3', selToText(headerChunkValueEl, 'author', true))
				);
				continue;
			}

			if (headerChunk.name === '.t_annotations') {
				_annots = {id: hid, xml: parseXml(headerChunk.value), list: [], ref: {}, changed: false}
				each('annotation', (annot, index) => {
					_annots.list.push(annot);
					each('token', token => {
						const target = token.getAttribute('target');
						(_annots.ref[target] ??= {})[index] = (token.previousElementSibling ? 0 : 1)
							+ (token.nextElementSibling ? 0 : 2);
					}, annot);
				}, _annots.xml);
				sel('#footer').replaceChildren();
			}
		}
	});

	function getUID(xml, prefix) {
		// IDs are document-wide even though the editor stores the XML in chunks
		const ids = new Set();
		const collectIds = documentXml => {
			for (const element of documentXml.getElementsByTagName('*')) {
				const id = element.getAttribute('xml:id');
				if (id) ids.add(id);
			}
		};

		collectIds(xml);
		for (const activeXml of Object.values(_active)) if (activeXml !== xml) collectIds(activeXml);
		for (const [cid, chunk] of editor.chunks.entries()) if (!_active[cid]) collectIds(parseXml(chunk.value));
		for (const hidden of editor.hidden) collectIds(parseXml(hidden.value));

		let n = 1;
		let id = `${prefix}_${n}`;
		while (ids.has(id)) id = `${prefix}_${++n}`;

		return id;
	}

	function delNode(node) {
		const prev = node.previousSibling;
		if (prev?.nodeName === '#text') prev.remove();
		node.remove();
	}

	function createTdElement(content = '&nbsp;', className = 'as-parent') {
		const el = document.createElement('td');
		el.className = className;
		TOKEN.appendContent(el, content);
		return el;
	}

	function isModified(node) {
		return !!node && (node.getAttribute('modified') === 'True' || !!sel('[modified="True"]', node));
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

		// Highlight the token when it or any of its fields was changed manually
		if (isModified(token)) wordEl.classList.add('modified');

		let morph = sel('morph', token);
		if (!morph || morph.getAttribute('check') === 'True') {
			morph = false;
		} else {
			wordEl.classList.add('unchecked');
			if (find('ana', morph).length === 1) wordEl.classList.add('single');
		}

		if (tableView) {
			const ana = sel('ana[correct="True"]', token);
			const wordVal = word.textContent || '&nbsp;';
			const lemma = ana ? sel('lemma', ana).textContent : '&nbsp;';
			const detailed = ana ? sel('detailed', ana).textContent : '&nbsp;';
			const simple = ana ? sel('simple', ana).textContent : '&nbsp;';

			wordEl.appendChild(createTdElement(wordVal));
			wordEl.appendChild(createTdElement(lemma));
			wordEl.appendChild(createTdElement(detailed));
			wordEl.appendChild(createTdElement(simple));

			if (morph && ana) {
				// Default selected
				const tokenEl = createTdElement('✓', 'selAna');
				tokenEl.dataset.tid = tid;
				tokenEl.dataset.ana = 'default';
				wordEl.appendChild(tokenEl);
			} else {
				// Empty
				wordEl.appendChild(createTdElement());
			}
		} else {
			TOKEN.replaceContent(wordEl, word.textContent || TOKEN.EMPTY_TEXT);
		}
		return wordEl;
	}

	function renderSentence(sentence, sid, tableView) {
		// Create and setup sentence element
		let sentenceEl = document.createElement(tableView ? 'table' : 'div');
		sentenceEl.className = 's';
		sentenceEl.dataset.sid = sid;
		if (tableView) {
			const tbody = document.createElement('tbody');
			tbody.appendChild(TOKEN.createHeaderRow(TOKEN.MORPH_HEADERS));
			sentenceEl.appendChild(tbody);
			// Change from <table> to <tbody>
			sentenceEl = sentenceEl.children[0];
		}
		// Put each token into the sentence element
		each('token', (token, tid) => {
			const renderedToken = renderToken(token, tid, tableView);

			if (renderedToken) sentenceEl.appendChild(renderedToken);
		}, sentence);

		// Create the config row for the sentence
		const row = TOKEN.createSettingsRow(tableView, TOKEN.MORPH_HEADERS.length);
		if (!sentence.getAttribute('sent')) row.classList.add('unchecked');
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

	function savePar(paragraphIds) {
		// Annotations are considered hidden data, commit changes
		const hdata = {};
		if (_annots.changed) {
			hdata[_annots.id] = _annots.xml.documentElement.outerHTML;
			_annots.changed = false;
		}
		return editor.onchange(paragraphIds, hdata);
	}

	function updAnnot(from, to) {
		if (!_annots.xml) return;
		const sourceIds = from.filter(Boolean);
		if (!sourceIds.length) return;

		const firstTarget = to[0]?.getAttribute('xml:id');
		const selector = sourceIds.map(id => `[target="${id}"]`).join(',');
		each(selector, token => {
			_annots.changed = true;
			const annot = token.closest('annotation');
			const target = token.getAttribute('target');
			if (firstTarget && (!sel(`[target="${firstTarget}"]`, annot) || firstTarget === target)) {
				for (const dest of to) {
					const newToken = _annots.xml.createElement('token');
					newToken.setAttribute('target', dest.getAttribute('xml:id'));
					newToken.textContent = sel('form', dest).textContent;
					annot.insertBefore(newToken, token);
				}
			}
			token.remove();
		}, _annots.xml);
	}

	function updJoin(tokenId, tokens) {
		const left = tokenId > 0 && ['right', 'both'].includes(tokens[tokenId - 1].getAttribute('join'));
		const right = tokenId < tokens.length - 1 && ['left', 'both'].includes(tokens[tokenId + 1].getAttribute('join'));
		let join = 'no';
		if (left && right) join = 'both';
		else if (left) join = 'left';
		else if (right) join = 'right';

		tokens[tokenId].setAttribute('join', join);
	}

	function updAna(tokens, paragraphId) {
		// Recursively process (to force sequential processing) all tokens in the paragraph
		const token = tokens.shift();
		const formData = new FormData();
		formData.append('file', new Blob([`form\n${sel('form', token).textContent}\n`], {type: 'text/plain'}), 'input.txt');
		fetch(EMTSV_URL, {method: 'POST', body: formData})
			.then(r => r.text()).then(data => {
			const analyses = JSON.parse(data.replace(/^[^\r\n]*[\r\n]+[^\t]*\t/, ''));

			// Remove existing analyses
			const morph = sel('morph', token);
			each('ana', delNode, morph);

			// Based on a template analysis create a copy and fill the fields
			const tpl = sel('ana', _active[paragraphId]);
			for (const item of analyses) {
				const ana = tpl.cloneNode(true);
				ana.setAttribute('correct', 'False');
				sel('lemma', ana).textContent = item.lemma;
				sel('detailed', ana).textContent = item.readable;
				sel('simple', ana).textContent = item.tag;
				if (tpl.previousSibling?.nodeName === '#text')
					morph.insertBefore(_active[paragraphId].createTextNode(tpl.previousSibling.textContent), ana);
				morph.appendChild(ana);
			}
			// Mark as unchecked
			morph.setAttribute('check', 'False');
			if (tokens.length) {
				updAna(tokens, paragraphId);
			} else {
				savePar([paragraphId]);
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

		// In table view the click lands on a <td class="as-parent">,
		// while the token class and data-tid live on its parent <tr>
		// Both nodes have the same .s ancestor, so this normalization is needed for token lookup,
		// not for resolving the sentence
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
			target,
			...paragraphCtx,
			sentences,
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

	function handleTokenContextMenu(e, target, sentence, sentenceXml, tokens, tokenId, tokenXml) {
		// Clear active
		each('.par .active', i => i.classList.remove('active'));

		const items = [];
		if (tokenXml) { // Token
			// Set the current tooltip active
			target.classList.add('active');

			// Setup elements
			if (sel('morph', tokenXml)) items.push(TOKEN.createLink(tokenId, 'edit ana', 'Select Ana.'));
			// TODO: check if this case even possible
			// Annotation features are available only when the document has an <annotations> section
			if (_annots.xml) {
				items.push(TOKEN.createSelect(tokenId, 'add annot', '', 'New Annotation...', ANNOT_TYPE));
				const addIfHas = (list, label) => {
					if (Object.keys(list).length) items.push(TOKEN.createSelect(tokenId, label.key, '', label.text, list));
				};

				const buildList = (items, filterFun, prefix = '') => {
					const list = {};
					for (const i in items || {}) {
						if (!filterFun(items[i])) continue;
						list[prefix + i] = xmlToText(_annots.list[i].innerHTML, true);
					}
					return list;
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
			items.push(TOKEN.createSelect(tokenId, 'edit sticky', tokenXml.getAttribute('join') || '?', 'Sticks To...',
				TOKEN_STICKY));

			// Setup possible token splittings
			const tokenValue = selToText(tokenXml, 'form', true);
			if (tokenValue.length > 1) {
				const split = {};
				for (let i = 1; i < tokenValue.length; ++i)
					split[i] = encXml(tokenValue.slice(0, i)) + ' | ' + encXml(tokenValue.slice(i));
				items.push(TOKEN.createSelect(tokenId, 'split token', '', 'Split Token...', split));
			}
			// Setup other elements
			items.push(TOKEN.createLink(tokenId, 'edit token', 'Fix Token')); // Change the value freely
			items.push(TOKEN.createSelect(tokenId, 'join token', '', 'Join Token...', TOKEN.SEL_WHERE));
			items.push(TOKEN.createLink(tokenId, 'ins token', 'Insert Token'));
			items.push(TOKEN.createLink(tokenId, 'del token', 'Delete Token'));
			items.push(TOKEN.createSelect(tokenId, 'split sent', '', 'Split Sentence...', TOKEN.SEL_WHERE));
		} else {
			// Setup elements for the cogwheel (sentence-wide) menu
			sentence.classList.add('active');
			items.push(TOKEN.createSelect(tokenId, 'edit sent', (sentenceXml.getAttribute('sent') || '').split(';'),
				'Select Sentinence...', SENT_TYPE, true));
			items.push(TOKEN.createSelect(tokenId, 'join sent', '', 'Join Sentence...', TOKEN.SEL_WHERE));
			items.push(TOKEN.createSelect(tokenId, 'move sent', '', 'Move Sentence...', TOKEN.SEL_WHERE));
		}

		// Show the tooltip a dropdown menu
		const tt = ttip(target, e);
		tt.classList.add('dropdown');
		for (const item of items) tt.appendChild(item);
	}

	function handleEditAna(e, target, sentence, tokenId, tokenXml) {
		const form = selToText(tokenXml, 'form', true);
		const btn = (tid, anaId = '', selected = false) => {
			const button = TOKEN.createLink(tid, `btn selAna${selected ? ' selected' : ''}`, '\u2713');
			button.dataset.ana = anaId;
			return button;
		};
		const headers = TOKEN.MORPH_HEADERS;
		const rows = [];

		// Existing analyses
		each('ana', (anaXml, anaId) => {
			if (anaXml.getAttribute('modified') === 'True') return;
			rows.push([selToText(anaXml, 'lemma', true), selToText(anaXml, 'detailed', true),
				selToText(anaXml, 'simple', true),
				btn(tokenId, anaId, anaXml.getAttribute('correct') === 'True')]);
		}, tokenXml);

		// Modified / Editable ana
		const ana = sel('ana[modified="True"]', tokenXml);
		rows.push([
			TOKEN.createInput({value: ana ? selToText(ana, 'lemma', true) : ''}),
			TOKEN.createInput({value: ana ? selToText(ana, 'detailed', true) : ''}),
			TOKEN.createInput({value: ana ? selToText(ana, 'simple', true) : ''}),
			btn(tokenId, '', !!ana)
		]);

		const tt = ttip(sel('.cfg', sentence), e, true);
		tt.appendChild(TOKEN.createTokenTitle(headers[0], form));
		tt.appendChild(TOKEN.createTable(headers.slice(1), rows));
		tt.appendChild(TOKEN.createCenter(
			TOKEN.createLink(tokenId, 'btn ana fetch', 'Re-Analyze'),
			TOKEN.createLink(tokenId, 'btn ana save', 'Save')
		));

		evt('table input', 'focus', () => trg('.btn', 'click', this.closest('tr')), tt);
	}

	function handleSelAna(target, paragraphId, tokenXml) {
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
		each('ana', anaXml => anaXml.setAttribute('correct', 'False'), tokenXml);

		// Remove existing selected
		target.closest('table').querySelectorAll('.btn.selAna').forEach(b => b.classList.remove('selected'));

		// Add the new selected
		target.classList.add('selected');

		// Set Correct attribute in XML
		const anaIndex = target.dataset.ana;
		if (anaIndex != null) find('ana', tokenXml)[anaIndex]?.setAttribute('correct', 'True');
	}

	function handleSaveAna(target, paragraphId, paragraphXml, tokenXml) {
		const morph = sel('morph', tokenXml);
		const tooltip = target.closest('.tooltip');

		// Remove modified ana if present
		const mod = sel('ana[modified="True"]', morph);
		if (mod) delNode(mod);

		// If nothing is marked correct -> we must create one
		if (!sel('ana[correct="True"]', morph)) {
			let selected = sel('.selAna.selected', tooltip);
			if (!selected) return addMsg(_('No Selected Analyzation'), null, tooltip);

			const inputs = find('input', selected.closest('tr'));
			const vals = inputs.map(i => i.value.trim());
			if (!vals[0] || vals[0].includes(' ')) return addMsg(_('Invalid Format'), null, inputs[0]);

			// Validate format of tags (emMorph format detailed and compact version)
			// if (vals[1].length && !vals[1].match(/^\S+\[\/\S+\](=\S+)?(\s+\+\s+\S*\[[^\]]+\](=\S+)?)*$/))
			// 	return addMsg(_('Invalid Format'), null, inputs[1]);
			//
			// if (!vals[2].length || !vals[2].match(/^\[\/\S+\](\[[^\]]+\])*$/))
			// 	return addMsg(_('Invalid Format'), null, inputs[2]);

			const tpl = sel('ana', paragraphXml);
			const ana = tpl.cloneNode(true);
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

	function handleEditToken(e, sentence, tokenId, tokenXml) {
		const tt = ttip(sel('.cfg', sentence), e, true);
		tt.appendChild(TOKEN.createInput({value: selToText(tokenXml, 'form', true)}));
		tt.appendChild(TOKEN.createCenter(TOKEN.createLink(tokenId, 'btn token save', 'Save')));
	}

	function handleSaveToken(target, paragraphId, tokenXml) {
		const tooltip = target.closest('.tooltip');
		const input = sel('input', tooltip);
		const token = sel('form', tokenXml);
		const value = input.value.trim();

		// No change -> just close
		if (token.textContent === value) return trg(tooltip, 'close');

		// Validation
		if (!value || value.includes(' ')) return addMsg(_('Invalid Format'), null, input);
		token.setAttribute('modified', 'True');
		token.textContent = value;

		const morph = sel('morph', tokenXml);
		if (morph) {
			morph.setAttribute('check', 'False');
			morph.innerHTML = '';
		}

		updAna([tokenXml], paragraphId);
	}

	function handleInsertToken(e, sentence, tokenId, tokenXml) {
		const tt = ttip(sel('.cfg', sentence), e, true);
		const form = selToText(tokenXml, 'form', true);
		tt.appendChild(TOKEN.createInput());
		tt.appendChild(TOKEN.createCenter(
			TOKEN.createLink(tokenId, 'btn token ins-save left', 'Insert Before <b>%word%</b>', {word: form}),
			TOKEN.createLink(tokenId, 'btn token ins-save right', 'Insert After <b>%word%</b>', {word: form})
		));
	}

	function handleSaveInsertedToken(target, paragraphId, paragraphXml, sentenceXml, tokenXml) {
		// Get the new token and validate it
		const input = sel('input', target.closest('.tooltip'));
		const value = input.value.trim();

		// Validation
		if (!value || value.includes(' ')) return addMsg(_('Invalid Format'), null, input);

		// Clone the original token XML
		const newTokenXml = tokenXml.cloneNode(true);

		// Create new unique ID, store value and note modified status
		const tokenId = tokenXml.getAttribute('xml:id');
		if (tokenId) newTokenXml.setAttribute('xml:id', getUID(paragraphXml, tokenId));

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
		const target = e.target;
		if (!target) return;

		const ctx = resolveContext(target, {resolveTableCellParent: true});
		if (!ctx) return;

		// Open tooltip
		if (ctx.target.matches('.t, .cfg'))
			return handleTokenContextMenu(e, ctx.target, ctx.sentence, ctx.sentenceXml, ctx.tokens, ctx.tokenId,
				ctx.tokenXml);

		if (ctx.target.matches('.edit.ana')) return handleEditAna(e, ctx.target, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.selAna')) return handleSelAna(ctx.target, ctx.paragraphId, ctx.tokenXml);

		if (ctx.target.matches('.save.ana'))
			return handleSaveAna(ctx.target, ctx.paragraphId, ctx.paragraphXml, ctx.tokenXml);

		if (ctx.target.matches('.fetch.ana')) return updAna([ctx.tokenXml], ctx.paragraphId);

		if (ctx.target.matches('.edit.token')) return handleEditToken(e, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.save.token')) return handleSaveToken(ctx.target, ctx.paragraphId, ctx.tokenXml);

		if (ctx.target.matches('.ins.token')) return handleInsertToken(e, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.ins-save.token'))
			return handleSaveInsertedToken(ctx.target, ctx.paragraphId, ctx.paragraphXml, ctx.sentenceXml, ctx.tokenXml);

		if (ctx.target.matches('.del.token')) {
			const xmlId = ctx.tokenXml.getAttribute('xml:id');
			delNode(ctx.tokenXml);
			updAnnot([xmlId], []);
			savePar([ctx.paragraphId]);
		}

	});

	function handleEditSticky(paragraphId, tokens, tokenId, tokenXml, value) {
		tokenXml.setAttribute('join', value);

		[tokenId - 1, tokenId + 1].forEach(i => {
			if (i >= 0 && i < tokens.length) updJoin(i, tokens);
		});

		savePar([paragraphId]);
	}

	function handleSplitToken(paragraphId, paragraphXml, sentenceXml, tokenXml, value) {
		// Select token to modify
		const wordEl = sel('form', tokenXml);
		const text = wordEl.textContent;

		const index = Number(value);
		if (isNaN(index) || index < 0 || index > text.length) return;

		const morph = sel('morph', tokenXml);
		if (morph) {
			morph.setAttribute('check', 'False');
			morph.innerHTML = '';
		}

		// Split text
		const left = text.slice(0, index);
		const right = text.slice(index);

		// Clone the original token XML
		const newTokenXml = tokenXml.cloneNode(true);

		// Create new unique ID, store value and note modified status
		const tokenId = tokenXml.getAttribute('xml:id');
		if (tokenId) newTokenXml.setAttribute('xml:id', getUID(paragraphXml, tokenId));

		const newWordEl = sel('form', newTokenXml);

		// Update original + new token
		wordEl.textContent = left;
		wordEl.setAttribute('modified', 'True');

		newWordEl.textContent = right;
		newWordEl.setAttribute('modified', 'True');

		// Insertion point (insert after current token)
		const referenceNode = tokenXml.nextSibling;

		// Preserve whitespace
		const previousText = tokenXml.previousSibling?.nodeName === '#text' ? tokenXml.previousSibling.textContent : '';

		// Insert new token and reinsert whitespace
		sentenceXml.insertBefore(newTokenXml, referenceNode);
		if (previousText) sentenceXml.insertBefore(paragraphXml.createTextNode(previousText), referenceNode);

		// Save changes and refresh UI
		if (tokenId) updAnnot([tokenId], [tokenXml, newTokenXml]);
		updAna([tokenXml, newTokenXml], paragraphId);
	}

	function handleJoinToken(paragraphId, paragraphXml, sentenceXml, tokens, tokenId, tokenXml, value) {
		// Find neighbouring token
		const joinRight = value !== '0';
		const offset = joinRight ? 1 : -1;
		const newTokenXml = tokens[Number(tokenId) + offset];
		if (!newTokenXml) return addMsg(_('Invalid Action'));

		const [keepToken, removeToken] = offset > 0 ? [tokenXml, newTokenXml] : [newTokenXml, tokenXml];
		const joinedWord = selToText(keepToken, 'form') + selToText(removeToken, 'form');

		// Join text
		const needsMorph = sel('morph', keepToken) || sel('morph', removeToken);
		keepToken.innerHTML = '';
		const form = paragraphXml.createElement('form');
		form.setAttribute('modified', 'True');
		form.textContent = joinedWord;
		keepToken.appendChild(form);
		if (needsMorph) {
			const morph = paragraphXml.createElement('morph');
			morph.setAttribute('check', 'False');
			keepToken.appendChild(morph);
		}

		// Preserve an existing ID on the merged token
		// Prefer the survivor's ID; if it lacks one, reuse the removed token's ID
		const keepId = keepToken.getAttribute('xml:id');
		const removeId = removeToken.getAttribute('xml:id');
		delNode(removeToken);
		if (!keepId && removeId) keepToken.setAttribute('xml:id', removeId);

		// Save changes and refresh UI
		const oldIds = [keepId, removeId].filter(Boolean);
		if (oldIds.length) updAnnot(oldIds, [keepToken]);
		updAna([keepToken], paragraphId);
	}

	function handleEditSentinence(paragraphId, sentenceXml) {
		// Edit sentiment value for sentence
		const value = value.join(';');
		if ((sentenceXml.getAttribute('sent') || '') === value) return;
		sentenceXml.setAttribute('sent', value);
		savePar([paragraphId]);
	}

	function handleSplitSentence(paragraphId, paragraphXml, sentenceXml, tokens, tokenId, value) {
		// Determine split point
		const offset = value === '0' ? 0 : 1;
		const splitToken = tokens[Number(tokenId) + offset];
		if (!splitToken || splitToken === tokens[0]) return addMsg(_('Invalid Action'));

		// Preserve indentation
		const indent = sentenceXml.previousSibling?.nodeName === '#text' ? sentenceXml.previousSibling.textContent : '';

		// Mark sentence and insert split marker
		sentenceXml.setAttribute('modified', 'True');
		sentenceXml.insertBefore(paragraphXml.createElement('split'), splitToken);

		// Create new sentence ID
		const root = paragraphXml.documentElement;
		const idBase = sentenceXml.getAttribute('xml:id');
		const newSentence = `</${sentenceXml.nodeName}>` + indent + `<${sentenceXml.nodeName}`
			+ (idBase ? ` xml:id="${getUID(paragraphXml, idBase)}"` : '') + ' modified="True"> ';

		// Replace marker with sentence boundary
		root.innerHTML = root.innerHTML.replace(/([ \t\r\n]*)<split[^>]*>/, indent + newSentence + '$1');

		// Save changes and refresh UI
		savePar([paragraphId]);
	}

	function handleJoinSentence(paragraph, paragraphId, paragraphXml, sentences, sentenceId, sentenceXml, value) {
		// Determine direction
		const joinRight = value !== '0';
		const offset = joinRight ? 1 : -1;

		let keepSentence;
		let removeSentence;
		let paragraphIds;

		// Determine survivor and removed node
		const adjacentSentence = sentences[sentenceId + offset];
		if (adjacentSentence) {
			[keepSentence, removeSentence] = joinRight ? [sentenceXml, adjacentSentence] : [adjacentSentence, sentenceXml];
			paragraphIds = [paragraphId];
		} else {
			const adjacentParagraphId = paragraphId + offset;
			if (!_active[adjacentParagraphId]) {
				const chunk = editor.renderChunk(adjacentParagraphId);
				if (chunk) paragraph.parentNode.insertBefore(chunk, joinRight ? paragraph.nextSibling : paragraph);
			}
			if (!_active[adjacentParagraphId]) return addMsg(_('Invalid Action'));

			[keepSentence, removeSentence] = joinRight ? [sentenceXml, sel('s', _active[adjacentParagraphId])]
				: [sel('s:last-of-type', _active[adjacentParagraphId]), sentenceXml];
			paragraphIds = joinRight ? [paragraphId, adjacentParagraphId] : [adjacentParagraphId, paragraphId];
		}
		if (!keepSentence || !removeSentence) return addMsg(_('Invalid Action'));

		// Merge sentences
		keepSentence.setAttribute('modified', 'True');
		keepSentence.innerHTML = keepSentence.innerHTML.replace(/[ \r\n\t]+$/, '') + removeSentence.innerHTML;

		// Preserve an existing ID on the merged sentence
		// Prefer the survivor's ID; if it lacks one, reuse the removed sentence's ID
		const keepId = keepSentence.getAttribute('xml:id');
		const removeId = removeSentence.getAttribute('xml:id');
		delNode(removeSentence);
		if (!keepId && removeId) keepSentence.setAttribute('xml:id', removeId);

		savePar(paragraphIds);
	}

	function handleMoveSentence(paragraph, paragraphId, paragraphXml, sentences, sentenceId, sentenceXml, value) {
		// Determine destination paragraph
		const moveToNextParagraph = value !== '0';
		const offset = moveToNextParagraph ? 1 : -1;
		const adjacentParagraphId = paragraphId + offset;

		// Ensure target paragraph is loaded
		if (!_active[adjacentParagraphId]) {
			const chunk = editor.renderChunk(adjacentParagraphId);
			if (chunk) paragraph.parentNode.insertBefore(chunk, moveToNextParagraph ? paragraph.nextSibling : paragraph);
		}

		// Validate move
		const isLastSentence = sentenceId === sentences.length - 1;
		const isFirstSentence = sentenceId === 0;
		if (!_active[adjacentParagraphId] || (moveToNextParagraph && !isLastSentence) || (offset < 0 && !isFirstSentence))
			return addMsg(_('Invalid Action'));

		// Move sentence
		const targetParagraph = _active[adjacentParagraphId].documentElement
		if (moveToNextParagraph) {
			targetParagraph.innerHTML =
				targetParagraph.innerHTML.replace(/([ \t\r\n]*)</, '$1' + sentenceXml.outerHTML + '$1<');
		} else {
			const indent = sentenceXml.previousSibling?.nodeName === '#text' ? sentenceXml.previousSibling.textContent : '';
			targetParagraph.innerHTML =
				targetParagraph.innerHTML.replace(/([ \t\r\n]*)$/, indent + sentenceXml.outerHTML + '$1');
		}
		delNode(sentenceXml);

		// Save changes
		savePar(moveToNextParagraph ? [paragraphId, adjacentParagraphId] : [adjacentParagraphId, paragraphId]);
	}

	function handleAddAnnotation(tokenXml, value) {
		if (!_annots.xml) return;

		const {xml} = _annots;
		const targetId = tokenXml.getAttribute('xml:id');

		const target = xml.createElement(tokenXml.nodeName);
		target.setAttribute('target', targetId);
		target.textContent = sel('form', tokenXml).textContent;
		const annotation = xml.createElement('annotation');
		annotation.setAttribute('entity', value);
		annotation.appendChild(target);

		xml.documentElement.appendChild(annotation);
		const annotationId = _annots.list.push(annotation) - 1;
		(_annots.ref[targetId] ??= {})[annotationId] = 3;
		_annots.changed = true;

		savePar([]);
	}

	function handleAddToAnnotation(tokenXml, value) {
		const xml = _annots.xml;
		if (!xml) return;

		const position = value[0];
		const annotation = _annots.list[value.slice(1)];

		const target = xml.createElement(tokenXml.nodeName);
		target.setAttribute('target', tokenXml.getAttribute('xml:id'));
		target.textContent = sel('form', tokenXml).textContent;
		annotation.insertBefore(target, position === 'F' ? annotation.firstElementChild : null);

		_annots.changed = true;
		savePar([]);
	}

	function handleDeleteFromAnnotation(tokenXml, value) {
		if (!_annots.xml) return;

		const annotation = _annots.list[value];
		const targetId = tokenXml.getAttribute('xml:id');
		sel(`[target="${targetId}"]`, annotation).remove();
		if (!sel('[target]', annotation)) annotation.remove();

		_annots.changed = true;
		savePar([]);
	}

	document.addEventListener('change', e => {
		const target = e.target;
		if (!target) return;

		const ctx = resolveContext(target, {includeValue: true});
		if (!ctx) return;

		// Token stuff
		if (target.matches('.edit.sticky'))
			return handleEditSticky(ctx.paragraphId, ctx.tokens, ctx.tokenId, ctx.tokenXml, ctx.value);

		if (target.matches('.split.token'))
			return handleSplitToken(ctx.paragraphId, ctx.paragraphXml, ctx.sentenceXml, ctx.tokenXml, ctx.value);

		if (target.matches('.join.token'))
			return handleJoinToken(ctx.paragraphId, ctx.paragraphXml, ctx.sentenceXml, ctx.tokens, ctx.tokenId, ctx.tokenXml,
				ctx.value);

		// Sentence stuff
		if (target.matches('.edit.sent')) return handleEditSentinence(ctx.paragraphId, ctx.sentenceXml);

		if (target.matches('.split.sent'))
			return handleSplitSentence(ctx.paragraphId, ctx.paragraphXml, ctx.sentenceXml, ctx.tokens, ctx.tokenId,
				ctx.value);

		if (target.matches('.join.sent'))
			return handleJoinSentence(ctx.paragraph, ctx.paragraphId, ctx.paragraphXml, ctx.sentences, ctx.sentenceId,
				ctx.sentenceXml, ctx.value);

		if (target.matches('.move.sent'))
			return handleMoveSentence(ctx.paragraph, ctx.paragraphId, ctx.paragraphXml, ctx.sentences, ctx.sentenceId,
				ctx.sentenceXml, ctx.value);

		// Annotation stuff
		if (target.matches('.add.annot')) return handleAddAnnotation(ctx.tokenXml, ctx.value);

		if (target.matches('.addto.annot')) return handleAddToAnnotation(ctx.tokenXml, ctx.value);

		if (target.matches('.delfrom.annot')) return handleDeleteFromAnnotation(ctx.tokenXml, ctx.value);
	});
})();
