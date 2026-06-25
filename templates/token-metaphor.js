(function () {
	const PRIMARY_MEANING_INDEX = '1';
	const REASONING_PREVIEW_WORDS = 15;
	const TOKEN_SURFACE_FIELD = 'form';
	const LEGACY_TOKEN_SURFACE_FIELD = 'word';
	const MEANING_FIELD = Object.freeze({
		PRIMARY: 'primary',
		OTHER: 'other',
		CONTEXTUAL_INDEX: 'contextualIndex',
	});

	const MEANING_FIELDS = Object.freeze([
		MEANING_FIELD.PRIMARY,
		MEANING_FIELD.OTHER,
		MEANING_FIELD.CONTEXTUAL_INDEX,
	]);

	const INDIRECT = {
		'0': '-',
		'1': 'Metonymy',
		'2': 'Generalization',
		'3': 'Specification'
	}

	const TOKEN_FIELDS = Object.freeze([
		TOKEN_SURFACE_FIELD,
		'lemma',
		'pos',
		'nerTag',
		'meanings',
		'metaphor',
		'otherIndirect',
		'comment',
	]);
	const TABLE_FIELDS = Object.freeze([...TOKEN_FIELDS.slice(0, -1), 'reasoning', 'comment']);

	Locale[TOKEN_SURFACE_FIELD] = 'szó';
	Locale['lemma'] = 'lemma';
	Locale['pos'] = 'szófaj';
	Locale['nerTag'] = 'névelem';
	Locale['meanings'] = 'jelentés';
	Locale['metaphor'] = 'metafora';
	Locale['otherIndirect'] = 'indirekt';
	Locale['comment'] = 'megjegyzés';
	Locale['reasoning'] = 'érvelés';
	Locale[MEANING_FIELD.PRIMARY] = 'elsődleges';
	Locale[MEANING_FIELD.OTHER] = 'többi';
	Locale[MEANING_FIELD.CONTEXTUAL_INDEX] = 'jelenleg';
	Locale['Metonymy'] = 'metonímia';
	Locale['Generalization'] = 'generalizáció';
	Locale['Specification'] = 'specifikáció';
	Locale['Meanings'] = 'Jelentések';
	Locale['Reasoning'] = 'Érvelés';
	Locale['Content'] = 'Tartalom (szöveges)';
	Locale['Set Paragraph...'] = 'Bekezdés felülírása';
	Locale['New Text for Metaphor Detection'] = 'Új szöveg metafora detektáláshoz';
	Locale['File Name'] = 'Fájlnév';
	Locale['Content'] = 'Tartalom';
	Locale['Submit'] = 'Beküldés';
	Locale['Please fill in all fields'] = 'Kérjük, töltse ki az összes mezőt';
	Locale['Network error'] = 'Hálózati hiba';
	Locale['New document creation not supported for this template'] = 'Új dokumentum létrehozása nem támogatott' +
		' ennél a sablonnál';
	Locale['Token Legend'] = 'Tokenek jelmagyarázata';
	Locale['Metaphor'] = 'Metafora';
	Locale['Other Indirect Meaning'] = 'Egyéb indirekt jelentés';
	Locale['Direct meaning'] = 'Közvetlen jelentés';
	Locale['API response format is incorrect'] = 'Az API válasz formátuma helytelen';
	Locale['API server error'] = 'API szerver hiba';
	Locale['Processing...'] = 'Feldolgozás...';
	Locale['Please provide API URL'] = 'Kérjük adjon meg API URL-t';
	Locale['Please provide content'] = 'Kérjük adjon meg szöveget';
	Locale['Invalid API response'] = 'Érvénytelen API válasz';
	Locale['Invalid or wrong API URL'] = 'Érvénytelen vagy hibás API URL';
	Locale['unknown error'] = 'ismeretlen hiba';
	Locale['Invalid bearer token'] = 'Érvénytelen API token';
	Locale['Request timeout'] = 'Kérés időtúllépése';
	Locale['Network error:'] = 'Hálózati hiba:';

	Locale['Manually modified'] = 'Kézzel módosítva';

	function normalizeText(value) {
		return value
			.replaceAll('\\n', '\n')
			.replaceAll('\\t', '\t')
			.trim()
			.replace(/[\t ]+/g, ' ')
			.replace(/ *\n */g, '\n');
	}

	function getText(el) {
		return el ? normalizeText(el.textContent) : '';
	}

	function getTokenSurface(token) {
		return sel(TOKEN_SURFACE_FIELD, token) || sel(LEGACY_TOKEN_SURFACE_FIELD, token);
	}

	function getTokenField(token, field) {
		return field === TOKEN_SURFACE_FIELD ? getTokenSurface(token) : sel(field, token);
	}

	function getTokenFieldText(token, field, decode) {
		return xmlToText(getTokenField(token, field)?.innerHTML, decode);
	}

	function format(name, el) {
		// Extract value from the element, and return a human-readable formatted version
		const value = getText(el);
		switch (name) {
			case 'metaphor':
				return TOKEN.SEL_BOOL[value] ? _(TOKEN.SEL_BOOL[value]) : '&nbsp;';
			case 'otherIndirect':
				const indirect = INDIRECT[['None', 'none'].includes(value) ? '0' : value];
				return indirect ? _(indirect) : '&nbsp;';
			case 'meanings':
				if (!el) return '&nbsp;';
				// Find the line whose numbering matches the contextual index
				const primary = selToText(el, MEANING_FIELD.PRIMARY, true);
				const other = selToText(el, MEANING_FIELD.OTHER, true);
				const index = selToText(el, MEANING_FIELD.CONTEXTUAL_INDEX, true);
				return (!index || index === PRIMARY_MEANING_INDEX ?
					primary : other.split('\n').find(line => line.trimStart().startsWith(`${index}.`))) || '&nbsp;';
			default:
				return value || '&nbsp;';
		}
	}

	const _active = {};
	const _content = {};

	Editor.TYPES.mm_p = {
		remove: function (input, chunk) {
			delete _active[input.dataset.cid];
		},
		getValue: function (input, chunk) {
			const cid = input.dataset.cid;
			const value = _content[cid];
			if (value) {
				delete _content[cid];
				return value;
			}
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

				if (hidden.name === '.mm_head') header = hidden.value;
			}

			// Parse the XML to paragraph format
			const x = parseXml(chunk.value);
			_active[Number(cid)] = x;
			const ep = parsePar(x);

			// Empty paragraph handling
			if (!ep.children.length) {
				ep.innerHTML = xmlToText(chunk.value) || `<em>${_('EMPTY')}</em>`;
			} else {
				ep.classList.add('par', 'tei');
			}

			// Add heading
			if (header) ep.innerHTML = `<h4>${header}</h4>${ep.innerHTML}`;
			return ep;
		},
	}

	evt(editor.dom, 'change-hidden', e => {
		// Find the header and print the legend
		// The value of hids is in e.detail
		const headerChunk = e.detail.map(hid => editor.hidden[hid]).find(h => h?.name === '.mm_header');
		if (!headerChunk) return;
		const x = parseXml(headerChunk.value);
		const legend = `
				<div class="legend">
						<h4>${_('Token Legend')}</h4>
						<div class="legend-item">
								<span class="legend-color metaphor-token"></span>
								${_('Metaphor')}
						</div>
						<div class="legend-item">
								<span class="legend-color indirect-token"></span>
								${_('Other Indirect Meaning')}
						</div>
						<div class="legend-item">
								<span class="legend-color direct-token"></span>
								${_('Direct meaning')}
						</div>
						<div class="legend-item">
								<span class="legend-modified" aria-hidden="true"></span>
								${_('Manually modified')}
						</div>
				</div>
		`;

		sel('#header').innerHTML = `
				<img alt="MetaphorAID logo" class="logo" src="./templates/assets/metaphor-aid.webp" style="height:3em"/>
				<h2>${selToText(x, 'title')}</h2>
				<h3>${selToText(x, 'author')}</h3>
				${legend}
		`;
	});

	function getUID(xml, prefix) {
		// IDs are document-wide even though the editor stores the XML in chunks.
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
		el.innerHTML = content;
		return el;
	}

	function isModified(node) {
		return !!node && (node.getAttribute('modified') === 'True' || !!sel('[modified="True"]', node));
	}

	function getTokenClass(token) {
		// Add background color based on metaphor and otherIndirect (applies to both table and normal view)
		// Use getText() instead of format(): these checks need the raw True/False and numeric values,
		// while format() converts them to localized display labels.
		let otherIndirect = getText(sel('otherIndirect', token));
		if (['None', 'none'].includes(otherIndirect)) otherIndirect = '0';

		const metaphor = getText(sel('metaphor', token));
		if (metaphor === 'True') return 'metaphor-token';
		if (metaphor === 'False' && otherIndirect && otherIndirect !== '0') return 'indirect-token';

		return 'direct-token';
	}

	function normalizeFieldValue(field, value) {
		value = normalizeText(value);
		return field === 'otherIndirect' && (['None', 'none'].includes(value) || !INDIRECT[value]) ? '0' : value;
	}

	function formatReasoningPreview(reasoning, tid) {
		const text = getText(reasoning);
		if (!text) return '&nbsp;';

		const words = text.split(/\s+/);
		const preview = encXml(words.slice(0, REASONING_PREVIEW_WORDS).join(' '));
		if (words.length <= REASONING_PREVIEW_WORDS) return preview;

		return `${preview} <a href="#" class="show reason" data-tid="${tid}" title="${_('Reasoning')}">&hellip;</a>`;
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
		const word = getTokenSurface(token);
		if (!word) return null;

		// Highlight the token when it or any of its fields was changed manually
		if (isModified(word)) wordEl.classList.add('modified');

		if (tableView) {
			for (const field of TABLE_FIELDS) {
				const fieldXml = getTokenField(token, field);
				const content = field === 'reasoning'
					? formatReasoningPreview(fieldXml, tid)
					: format(field, fieldXml).replaceAll('\n', '<br>');
				const fieldEl = createTdElement(content);
				if (field === 'reasoning') fieldEl.classList.add('reasoning-preview');
				if (isModified(fieldXml)) fieldEl.classList.add('modified');
				wordEl.appendChild(fieldEl);
			}
		} else {
			wordEl.innerHTML = word.innerHTML || '&nbsp;';
		}

		// Add background coloring based on token class
		wordEl.classList.add(getTokenClass(token));
		return wordEl;
	}

	function renderSentence(sentence, sid, tableView) {
		// Create and setup sentence element
		let sentenceEl = document.createElement(tableView ? 'table' : 'div');
		sentenceEl.className = 's';
		sentenceEl.dataset.sid = sid;
		if (tableView) {
			const headers = TOKEN.renderHeaderCells(TABLE_FIELDS);
			sentenceEl.innerHTML = `<tbody><tr>${headers}</tr></tbody>`;
			// Change from <table> to <tbody>
			sentenceEl = sentenceEl.children[0];
		}
		// Put each token into the sentence element
		each('token', (token, tid) => {
			const renderedToken = renderToken(token, tid, tableView);

			if (renderedToken) sentenceEl.appendChild(renderedToken);
		}, sentence);

		// Create the config row for the sentence
		const row = TOKEN.createSettingsRow(tableView, TABLE_FIELDS.length);
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
		// No hidden data to change
		const hdata = {};
		return editor.onchange(paragraphIds, hdata);
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

	function handleTokenContextMenu(e, target, sentence, tokenId, tokenXml) {
		// Clear active
		each('.par .active', i => i.classList.remove('active'));

		let html = '';
		if (tokenXml) {  // Token
			// Set the current tooltip active
			target.classList.add('active');

			// Setup elements
			html += TOKEN.getLink(tokenId, 'show info', 'Edit');
			html += TOKEN.getLink(tokenId, 'show meaning', 'Meanings');
			// Show reasoning if there is any
			if (selToText(tokenXml, 'reasoning', true)) html += TOKEN.getLink(tokenId, 'show reason', 'Reasoning');
			// Setup possible token splittings
			const tkn = getTokenFieldText(tokenXml, TOKEN_SURFACE_FIELD, true);
			if (tkn.length > 1) {
				const split = {};
				for (let i = 1; i < tkn.length; ++i) split[i] = encXml(tkn.slice(0, i)) + ' | ' + encXml(tkn.slice(i));
				html += TOKEN.getSelect(tokenId, 'split token', '', 'Split Token...', split);
			}
			// Setup other elements
			html += TOKEN.getSelect(tokenId, 'join token', '', 'Join Token...', TOKEN.SEL_WHERE);
			html += TOKEN.getLink(tokenId, 'ins token disabled', 'Insert Token');
			html += TOKEN.getLink(tokenId, 'del token disabled', 'Delete Token');
			html += TOKEN.getSelect(tokenId, 'split sent', '', 'Split Sentence...', TOKEN.SEL_WHERE);
		} else {
			// Setup elements for the cogwheel (sentence-wide) menu
			sentence.classList.add('active');
			html += TOKEN.getSelect(tokenId, 'join sent', '', 'Join Sentence...', TOKEN.SEL_WHERE);
			html += TOKEN.getSelect(tokenId, 'move sent', '', 'Move Sentence...', TOKEN.SEL_WHERE);
			html += TOKEN.getLink(tokenId, 'set content', 'Set Paragraph...');
		}

		// Show the tooltip a dropdown menu
		const tt = ttip(target, e);
		tt.classList.add('dropdown');
		tt.innerHTML = html;
	}

	function handleEditTokenInfo(e, sentence, tokenId, tokenXml) {
		const tt = ttip(sel('.cfg', sentence), e, true);
		const headers = [];
		const cells = [];
		// Setup elements for fields
		for (const field of TOKEN_FIELDS) {
			const fieldValue = getTokenFieldText(tokenXml, field, true);
			let td = '';
			switch (field) {
				case TOKEN_SURFACE_FIELD:
				case 'lemma':
				case 'pos':
				case 'nerTag':
					td = `<input type="text" name="${field}" class="input" value="${fieldValue}">`
					break;
				case 'meanings':
					// Meanings are edited in the dedicated Meanings tooltip.
					break;
				case 'comment':
					const commentValue = encXml(fieldValue);
					td = `<textarea name="${field}" class="input">${commentValue}</textarea>`;
					break;
				case 'metaphor':
					const checked = fieldValue === 'True';
					td = `<input type="checkbox" name="${field}" class="input" value="True" ${checked ? ' checked' : ''}>`;
					break;
				case 'otherIndirect':
					// Setup select element
					let oIValue = sel(field, tokenXml)?.textContent.trim() || '';
					if (['None', 'none'].includes(oIValue) || !INDIRECT[oIValue]) oIValue = '0';
					const selectEl = select(oIValue, '', INDIRECT);
					selectEl.classList.add('input');
					selectEl.dataset.name = field;
					td = selectEl.outerHTML;
					break;
				default:
					td = format(field, sel(field, tokenXml));
			}
			// Collect header value cell pairs
			if (td) {
				headers.push(field);
				cells.push(`<td>${td}</td>`);
			}
		}
		tt.innerHTML += `<table><tr>${TOKEN.renderHeaderCells(headers)}</tr><tr>${cells.join('')}</tr></table>
			<div class="center">${TOKEN.getLink(tokenId, 'btn info save', 'Save')}</div>`;
	}

	function handleEditMeaning(e, sentence, tokenId, tokenXml) {
		const tt = ttip(sel('.cfg', sentence), e, true);
		const headers = [];
		const cells = [];
		const hasMeanings = [MEANING_FIELD.PRIMARY, MEANING_FIELD.OTHER].some(field => selToText(tokenXml, field, true));

		for (const field of MEANING_FIELDS) {
			const value = field === MEANING_FIELD.CONTEXTUAL_INDEX && !hasMeanings ? '' : selToText(tokenXml, field, true);
			headers.push(field);
			switch (field) {
				case MEANING_FIELD.PRIMARY:
				case MEANING_FIELD.OTHER:
					cells.push(`<td><textarea name="${field}" class="input">${encXml(value)}</textarea></td>`);
					break;
				default:  // CONTEXTUAL_INDEX
					cells.push(`<td><input type="text" name="${field}" class="input" value="${value}"></td>`);
			}
		}
		tt.innerHTML += `<table><tr>${TOKEN.renderHeaderCells(headers)}</tr><tr>${cells.join('')}</tr></table>
			<div class="center">${TOKEN.getLink(tokenId, 'btn meaning save', 'Save')}</div>`;
	}

	function handleEditReason(e, sentence, tokenId, tokenXml) {
		const tt = ttip(sel('.cfg', sentence), e, true);
		tt.innerHTML += `<textarea name="reasoning" class="input">${
			encXml(selToText(tokenXml, 'reasoning', true))}</textarea>
      <div class="center">${TOKEN.getLink(tokenId, 'btn reason save', 'Save')}</div>`;
	}

	function handleSaveTokenFields(e, target, paragraphId, tokenXml) {
		// Handle saving the changes made in Token Info, Meaning and Reason
		const tooltip = target.closest('.tooltip');
		let changed = false;
		each('[name],[data-name]', i => {
			const field = i.dataset.name || i.name;
			// Get the old value
			const paragraphXml = getTokenField(tokenXml, field);
			if (!paragraphXml) return;
			// Convert checkbox value if it is checkbox type
			const value = i.type === 'checkbox' ? (i.checked ? 'True' : 'False') : (i.dataset.value || i.value).trim();
			// Compare old and new value
			if (normalizeFieldValue(field, value) !== normalizeFieldValue(field, getText(paragraphXml))) {
				changed = true;
				// Note the modification in the XML
				paragraphXml.setAttribute('modified', 'True');
				// console.log(value);
				paragraphXml.textContent = value;
			}
		}, tooltip);

		// Nothing is changed
		if (!changed) {
			trg(tooltip, 'close');
			return;
		}

		// Save paragraph
		savePar([paragraphId]);
	}

	function handleInsertToken(e, sentence, tokenId, tokenXml) {
		const tt = ttip(sel('.cfg', sentence), e, true);
		const form = getTokenFieldText(tokenXml, TOKEN_SURFACE_FIELD);
		tt.innerHTML += `<input type="text" class="input" value=""><div class="center">${
			TOKEN.getLink(tokenId, 'btn token ins-save left', `Insert Before <b>${form}</b>`)}${
			TOKEN.getLink(tokenId, 'btn token ins-save right', `Insert After <b>${form}</b>`)}</div>`;
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

		const token = getTokenSurface(newTokenXml);
		token.textContent = value;
		token.setAttribute('modified', 'True');

		// Determine the insertion point
		const insertBefore = target.classList.contains('left');
		const referenceNode = insertBefore ? tokenXml : tokenXml.nextSibling;
		// Preserve whitespace
		const previousText = tokenXml.previousSibling?.nodeName === '#text' ? tokenXml.previousSibling.textContent : '';
		// Insert the new token and reinsert the whitespace
		sentenceXml.insertBefore(newTokenXml, referenceNode);
		if (previousText) sentenceXml.insertBefore(paragraphXml.createTextNode(previousText), referenceNode);
		// Save changes and refress the UI
		savePar([paragraphId]);
	}

	function handleSetContent(e, sentence, tokenId) {
		// Display the set content dialog
		const tt = ttip(sel('.cfg', sentence), e, true);
		tt.innerHTML += `<input type="url" name="api" class="input" placeholder="API URL"
 			value="${localStorage['metaphor_api'] || ''}"><input type="password" name="token" class="input"
 			placeholder="API Token" value="${localStorage['metaphor_token'] || ''}">
			<textarea name="content" class="input" placeholder="${_('Content')}"></textarea>
			<div class="center">${TOKEN.getLink(tokenId, 'btn save content', 'Save')}</div>`;
	}

	function handleSaveContent(e, target, paragraphId) {
		// Get and store the input values
		const tooltip = target.closest('.tooltip');
		const apiInput = sel('[name="api"]', tooltip);
		const apiInputValue = apiInput.value;
		localStorage['metaphor_api'] = apiInput.value;
		const apiTokenValue = sel('[name="token"]', tooltip).value;
		localStorage['metaphor_token'] = apiTokenValue;
		const contentInput = sel('[name="content"]', tooltip);
		const text = contentInput.value.trim();
		if (!text) return addMsg(_('Please provide content'), false, contentInput);
		if (!apiInputValue) return addMsg(_('Please provide API URL'), false, apiInput);

		// Show loading state
		const originalText = target.textContent;
		target.textContent = _('Processing...');
		target.classList.add('disabled');
		fetch(apiInputValue, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Authorization': `Bearer ${apiTokenValue}`
			},
			body: JSON.stringify({text})
		}).then(r => {
			// Handle errors
			if (!r.ok) {
				if (r.status === 404) {
					return Promise.reject(_('Invalid or wrong API URL'));
				} else if (r.status >= 500) {
					return Promise.reject(_('API server error'));
				}
				return r.text().catch(() => _('Invalid API response')).then(text => {
					try {
						const data = JSON.parse(text);
						return Promise.reject(_(data.detail || 'unknown error'));
					} catch {
						return Promise.reject(_('Invalid or wrong API URL'));
					}
				});
			}
			return r.text();
		}).then(data => {
			if (typeof data !== 'string') return addMsg(_(data.detail || 'unknown error'), false, contentInput);
			try {
				// Handle success
				const xml = sel('body', parseXml(data));
				_content[paragraphId] = xml.innerHTML;
				editor.requestReload();
				return savePar([paragraphId]);
			} catch {
				addMsg(_('API response format is incorrect'), false, contentInput);
			}
		}).catch(err => addMsg(err || _('unknown error'), false, contentInput))
			.finally(() => {
				// Restore button state
				target.textContent = originalText;
				target.classList.remove('disabled');
			});
	}

	document.addEventListener('click', e => {
		const target = e.target;
		if (!target) return;

		// Cancel new document creation
		if (target && target.matches('.new-cancel')) return trg(target.closest('.tooltip'), 'close');

		const ctx = resolveContext(target, {resolveTableCellParent: true});
		if (!ctx) return;

		// Open tooltip
		if (ctx.target.matches('.t, .cfg'))
			return handleTokenContextMenu(e, ctx.target, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.show.info')) return handleEditTokenInfo(e, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.show.meaning')) return handleEditMeaning(e, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.show.reason')) return handleEditReason(e, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.save.info,.save.meaning,.save.reason'))
			return handleSaveTokenFields(e, ctx.target, ctx.paragraphId, ctx.tokenXml);

		if (ctx.target.matches('.ins.token')) return handleInsertToken(e, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.ins-save.token'))
			return handleSaveInsertedToken(ctx.target, ctx.paragraphId, ctx.paragraphXml, ctx.sentenceXml, ctx.tokenXml);

		if (ctx.target.matches('.del.token')) {
			delNode(ctx.tokenXml);
			savePar([ctx.paragraphId]);
			return;
		}

		if (ctx.target.matches('.set.content')) return handleSetContent(e, ctx.sentence, ctx.tokenId);

		if (ctx.target.matches('.save.content')) return handleSaveContent(e, ctx.target, ctx.paragraphId)
	});

	function handleSplitToken(paragraphId, paragraphXml, sentenceXml, tokenXml, value) {
		// Select token to modify
		const wordEl = getTokenSurface(tokenXml);
		const text = wordEl.textContent;

		const index = Number(value);
		if (isNaN(index) || index < 0 || index > text.length) return;

		// Split text
		const left = text.slice(0, index);
		const right = text.slice(index);

		// Clone the original token XML
		const newTokenXml = tokenXml.cloneNode(true);

		// Create new unique ID, store value and note modified status
		const tokenId = tokenXml.getAttribute('xml:id');
		if (tokenId) newTokenXml.setAttribute('xml:id', getUID(paragraphXml, tokenId));

		const newWordEl = getTokenSurface(newTokenXml);

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
		savePar([paragraphId]);
	}

	function handleJoinToken(paragraphId, paragraphXml, sentenceXml, tokens, tokenId, tokenXml, value) {
		// Find neighbouring token
		const joinRight = value !== '0';
		const offset = joinRight ? 1 : -1;
		const tokenXml2 = tokens[Number(tokenId) + offset];
		if (!tokenXml2) return addMsg(_('Invalid Action'));

		const [keepToken, removeToken] = offset > 0 ? [tokenXml, tokenXml2] : [tokenXml2, tokenXml];
		const keepWord = getTokenSurface(keepToken);
		if (!keepWord) return addMsg(_('Invalid Action'));
		const joinedWord = getTokenFieldText(keepToken, TOKEN_SURFACE_FIELD)
			+ getTokenFieldText(removeToken, TOKEN_SURFACE_FIELD);

		// Join text
		keepWord.setAttribute('modified', 'True');
		keepWord.textContent = joinedWord;

		// Keep the surviving token's complete ID; only the removed token loses its identity.
		const keepId = keepToken.getAttribute('xml:id');
		const removeId = removeToken.getAttribute('xml:id');
		delNode(removeToken);
		if (!keepId && removeId) keepToken.setAttribute('xml:id', removeId);

		// Save changes and refresh UI
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

		// Keep the surviving sentence's complete ID.
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

	document.addEventListener('change', e => {
		const target = e.target;
		if (!target) return;

		const ctx = resolveContext(target, {includeValue: true});
		if (!ctx) return;

		if (target.matches('.split.token'))
			return handleSplitToken(ctx.paragraphId, ctx.paragraphXml, ctx.sentenceXml, ctx.tokenXml, ctx.value);

		if (target.matches('.join.token'))
			return handleJoinToken(ctx.paragraphId, ctx.paragraphXml, ctx.sentenceXml, ctx.tokens, ctx.tokenId, ctx.tokenXml,
				ctx.value);

		// Sentence stuff
		if (target.matches('.split.sent'))
			return handleSplitSentence(ctx.paragraphId, ctx.paragraphXml, ctx.sentenceXml, ctx.tokens, ctx.tokenId,
				ctx.value);

		if (target.matches('.join.sent'))
			return handleJoinSentence(ctx.paragraph, ctx.paragraphId, ctx.paragraphXml, ctx.sentences, ctx.sentenceId,
				ctx.sentenceXml, ctx.value);

		if (target.matches('.move.sent'))
			return handleMoveSentence(ctx.paragraph, ctx.paragraphId, ctx.paragraphXml, ctx.sentences, ctx.sentenceId,
				ctx.sentenceXml, ctx.value);
	});

	function normalizeDocumentTitle(xml, filename) {
		// Derive a title from the filename
		const title = filename.replace(/\.xml$/i, '');
		if (!title) return xml;
		// If there is a title tag replace with the value of title else return the XML unchanged
		return xml.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${encXml(title)}</title>`);
	}

	Editor.registerNewDocumentType('metaphor', () => {
		// Create new metaphor documents
		return new Promise((resolve) => {
			const tt = ttip(sel('header'), null, true);

			const defaultFilename = 'uj-metafora-' + new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_')
				.replace(/Z$/, '') + '.xml';

			tt.innerHTML = `<h3 style="text-align: center;">${_('New Text for Metaphor Detection')}</h3>
			<input type="text" name="filename" class="input" placeholder="${_('File Name')}" value="${defaultFilename}">
			<input type="url" name="api" class="input" placeholder="API URL" value="${localStorage['metaphor_api'] || ''}">
			<input type="password" name="token" class="input" placeholder="API Token"
			 value="${localStorage['metaphor_token'] || ''}">
			<textarea name="content" class="input" placeholder="${_('Content')}"></textarea>
			<div class="center">
				<a href="#" class="btn metaphor-new-submit">${_('Submit')}</a>
				<a href="#" class="btn metaphor-new-cancel">${_('Cancel')}</a>
			</div>`;

			// Set minimum height for the modal to fit content
			tt.style.minHeight = '400px';
			tt.style.display = 'flex';
			tt.style.flexDirection = 'column';

			// Handle the submit button
			const submitBtn = sel('.metaphor-new-submit', tt);
			const cancelBtn = sel('.metaphor-new-cancel', tt);

			cancelBtn.onclick = () => {
				trg(tt, 'close');
				resolve(null);
			};

			submitBtn.onclick = async () => {
				let filename = sel('[name="filename"]', tt).value.trim();
				const api = sel('[name="api"]', tt).value.trim();
				const token = sel('[name="token"]', tt).value.trim();
				const content = sel('[name="content"]', tt).value.trim();

				if (!filename || !api || !content) return addMsg(_('Please fill in all fields'), 'error', tt);

				if (!filename.toLowerCase().endsWith('.xml')) filename += '.xml';

				localStorage['metaphor_api'] = api;
				localStorage['metaphor_token'] = token;

				// Show loading state
				const originalText = submitBtn.textContent;
				submitBtn.textContent = _('Processing...');
				submitBtn.classList.add('disabled');

				try {
					const r = await fetch(api, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json; charset=utf-8',
							'Authorization': 'Bearer ' + token
						},
						body: JSON.stringify({text: content})
					});

					// Check for authentication errors first
					if (r.status === 401) {
						addMsg(_('Invalid bearer token'), 'error', tt);
						// Reset button state
						submitBtn.textContent = originalText;
						submitBtn.classList.remove('disabled');
						return;
					}

					if (!r.ok) {
						// If JSON parsing fails, return status error
						let msg = _('API server error');
						try {
							const err = await r.json();
							msg = err.detail || err.message || msg;
						} catch {
						}
						addMsg(msg, 'error', tt);
						// Reset button state
						submitBtn.textContent = originalText;
						submitBtn.classList.remove('disabled');
						return;
					}

					const data = await r.text();

					trg(tt, 'close');
					resolve([filename, normalizeDocumentTitle(data, filename)]);
				} catch (err) {
					// Catch network errors and invalid bearer token errors
					let errorMsg = err.message;
					if (err.name === 'TypeError') {
						// Network error (could be CORS, connection refused, etc.)
						errorMsg = _('Network error:') + ' ' + err.message;
					}
					addMsg(errorMsg, 'error', tt);
					// Reset button state
					submitBtn.textContent = originalText;
					submitBtn.classList.remove('disabled');
				}
			};
		});
	});
})();
