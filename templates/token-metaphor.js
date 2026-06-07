(function () {
	const INDIRECT = {
		'0': '-',
		'1': 'metonímia',
		'2': 'generalizáció',
		'3': 'specifikáció'
	}

	const COLS = {
		'word': 'szó',
		'lemma': 'lemma',
		'pos': 'szófaj',
		'nerTag': 'névelem',
		'meanings': 'jelentés',
		'metaphor': 'metafora',
		'otherIndirect': 'indirekt',
		'comment': 'megjegyzés'
	}

	const MEANING = {
		'primary': 'elsődleges',
		'other': 'többi',
		'contextualIndex': 'jelenleg',
	}

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
	Locale['Token Color Legend'] = 'Token szín jelmagyarázat';
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

	function format(name, el) {
		// Extract and normalize display text from XML/HTML elements
		if (!el) return '&nbsp;';

		switch (name) {
			case 'metaphor':
				return _(TOKEN.SEL_BOOL[el.textContent] || '&nbsp;');
			case 'otherIndirect':
				let val = el.textContent.trim();
				if (val === 'None' || val === 'none') val = '0';
				return INDIRECT[val] || '&nbsp;';
			case 'meanings':
				const idx = sel('contextualIndex', el)?.textContent;
				if (!idx || idx === '1') return format('', sel('primary', el));

				// Find the line whose numbering matches the contextual index
				const lines = format('', sel('other', el)).split('\n');
				return lines.find(line => line.startsWith(`${idx}.`)) || '&nbsp;';
		}
		return el.textContent
			.replaceAll('\\n', '\n')
			.replaceAll('\\t', '\t')
			.trim()
			.replace(/[\t ]+/g, ' ')
			.replace(/ *\n */g, '\n');
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

				if ((hiddenId || 0) > currentId) break;
				if ((hiddenId || 0) < previousId) continue;

				if (hidden.name === '.mm_head') header = hidden.value;
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
			}

			// Add heading
			if (header) ep.innerHTML = '<h4>' + header + '</h4>' + ep.innerHTML;
			return ep;
		},
	}

	evt(editor.dom, 'change-hidden', function (e) {
		// Find the header and print the legend
		// The value of hids is in e.detail
		const headerChunk = e.detail.map(hid => editor.hidden[hid]).find(h => h?.name === '.mm_header');
		if (!headerChunk) return;
		const x = parseXml(headerChunk.value);
		const legend = `
				<div class="legend">
						<h4>${_('Token Color Legend')}</h4>
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

	function getTokenClass(token) {
		// Add background color based on metaphor and otherIndirect (applies to both table and normal view)
		let otherIndirect = sel('otherIndirect', token)?.textContent.trim();
		if (['None', 'none'].includes(otherIndirect)) otherIndirect = '0';

		const metaphor = sel('metaphor', token)?.textContent.trim();
		if (metaphor === 'True') return 'metaphor-token';
		if (metaphor === 'False' && otherIndirect && otherIndirect !== '0') return 'indirect-token';

		return 'direct-token';
	}

	function createConfigRow(tableView) {
		const row = document.createElement(tableView ? 'tr' : 'span');
		row.className = 'cfg';
		row.innerHTML = tableView ? '<td colspan="42" class="as-parent">⚙</td>' : '⚙';

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
		const word = sel('word', token);
		if (!word) return null;
		if (tableView) {
			for (const field in COLS) {
				const tokenEl = document.createElement('td');
				tokenEl.className = 'as-parent';
				tokenEl.innerHTML = format(field, sel(field, token)).replaceAll('\n', '<br>');
				wordEl.appendChild(tokenEl);
			}
		} else {
			wordEl.innerHTML = word.innerHTML || '&nbsp;';
		}

		wordEl.classList.add(getTokenClass(token));
		return wordEl;
	}

	function renderSentence(sentence, sid, tableView) {
		// Create and setup sentence element
		let sentenceEl = document.createElement(tableView ? 'table' : 'div');
		sentenceEl.className = 's';
		sentenceEl.dataset.sid = sid;
		if (tableView) {
			sentenceEl.innerHTML = '<tbody><tr><th>' + Object.values(COLS).join('</th><th>') + '</th></tr></tbody>'
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
		sentenceEl.appendChild(createConfigRow(tableView));

		return tableView ? sentenceEl.parentNode : sentenceEl;
	}

	function parsePar(dom) {
		// Create paragraph element
		const tableView = localStorage.tableview;
		const root = document.createElement('div');
		if (tableView) root.className = 'table';

		// Put sentences into the paragraph element
		each('s', (sentence, sid) => root.appendChild(renderSentence(sentence, sid, tableView)), dom);

		return root;
	}

	function savePar(cids) {
		const hdata = {};
		editor.onchange(cids, hdata);
	}

	function refresh(cids) {
		//TODO: update from API
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

	function handleTokenContextMenu(e, target, tokenXml, tokenId, sentence) {
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
			if (format('', sel('reasoning', tokenXml))) {
				html += TOKEN.getLink(tokenId, 'show reason', 'Reasoning');
			}
			// Setup possible token splittings
			let tkn = format('', sel('word', tokenXml));
			if (tkn.length > 1) {
				let split = {};
				for (let i = 1; i < tkn.length; ++i) split[i] = encXml(tkn.slice(0, i)) + ' | ' + encXml(tkn.slice(i));
				html += TOKEN.getSelect(tokenId, 'split token', '', 'Split Token...', split);
			}
			// Setup other elements
			html += TOKEN.getSelect(tokenId, 'join token', '', 'Join Token...', TOKEN.SEL_WHERE);
			html += TOKEN.getLink(tokenId, 'ins token disabled', 'Insert Token');
			html += TOKEN.getLink(tokenId, 'del token disabled', 'Delete Token');
			html += TOKEN.getSelect(tokenId, 'split sent', '', 'Split Sentence...', TOKEN.SEL_WHERE);
		} else {
			// Setup elements for non-tokens (punctuations?)
			sentence.classList.add('active');
			html += TOKEN.getSelect(tokenId, 'join sent', '', 'Join Sentence...', TOKEN.SEL_WHERE);
			html += TOKEN.getSelect(tokenId, 'move sent', '', 'Move Sentence...', TOKEN.SEL_WHERE);
			html += TOKEN.getLink(tokenId, 'set content', 'Set Paragraph...');
		}

		// Show the tooltip a dropdown menu
		let tt = ttip(target, e);
		tt.classList.add('dropdown');
		tt.innerHTML = html;
	}

	function handleEditTokenInfo(e, tokenXml, tokenId, sentence) {
		let tt = ttip(sel('.cfg', sentence), e, true);
		const headers = [];
		const cells = [];
		// Setup elements for fields
		for (const field in COLS) {
			const fieldValue = format('', sel(field, tokenXml));
			let td = '';
			switch (field) {
				case 'word':
				case 'lemma':
				case 'pos':
				case 'nerTag':
					td = `<input type="text" name="${field}" class="input" value="${fieldValue}">`
					break;
				case 'meanings':
					// const meaningsValue = format(field, sel(field, tokenXml));
					// const meanings = `${format('', sel('primary', tokenXml))}\n${format('', sel('other', tokenXml))}`;
					// td = meanings.replace(meaningsValue, `<strong>${meaningsValue}</strong>`).replaceAll('\n', '<br>');
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
					if (oIValue === 'None' || oIValue === 'none' || !INDIRECT[oIValue]) oIValue = '0';
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
				headers.push(`<th>${COLS[field]}</th>`);
				cells.push(`<td>${td}</td>`);
			}
		}
		tt.innerHTML += `<table><tr>${headers.join('')}</tr><tr>${cells.join('')}</tr></table>
			<div class="center">${TOKEN.getLink(tokenId, 'btn info save', 'Save')}</div>`;
	}

	function handleEditMeaning(e, tokenXml, tokenId, sentence) {
		const tt = ttip(sel('.cfg', sentence), e, true);
		const headers = [];
		const cells = [];

		for (const field in MEANING) {
			const value = format('', sel(field, tokenXml));
			headers.push(`<th>${MEANING[field]}</th>`);
			switch (field) {
				case 'primary':
				case 'other':
					cells.push(`<td><textarea name="${field}" class="input">${encXml(value)}</textarea></td>`);
					break;
				default:
					cells.push(`<td><input type="text" name="${field}" class="input" value="${value}"></td>`);
			}
		}
		tt.innerHTML += `<table><tr>${headers.join('')}</tr><tr>${cells.join('')}</tr></table>
			<div class="center">${TOKEN.getLink(tokenId, 'btn meaning save', 'Save')}</div>`;
		// let tt = ttip(sentence, e);
		// let value = format(field, sel(field, tokenXml));
		// const meanings = `${format('', sel('primary', tokenXml))}\n${format('', sel('other', tokenXml))}`;
		// tt.innerHTML += meanings.replace(value, `<strong>${value}</strong>`).replaceAll('\n', '<br>');
	}

	function handleEditReason(e, tokenXml, tokenId, sentence) {
		let tt = ttip(sel('.cfg', sentence), e, true);
		tt.innerHTML += `<textarea name="reasoning" class="input">${encXml(format('', sel('reasoning', tokenXml)))}</textarea>
      <div class="center">${TOKEN.getLink(tokenId, 'btn reason save', 'Save')}</div>`;

		// let tt = ttip(sentence, e);
		// tt.innerHTML += format('', sel('reasoning', tokenXml)).replaceAll('\n', '<br>');
	}

	function handleSaveTokenFields(e, target, tokenXml, paragraphId) {
		// Handle saving the changes made in Token Info, Meaning and Reason
		const tooltip = target.closest('.tooltip');
		let changed = false;
		each('[name],[data-name]', i => {
			// Get the old value
			const paragraphXml = sel(i.dataset.name || i.name, tokenXml);
			// Convert checkbox value
			const value = i.type === 'checkbox' ? (i.checked ? 'True' : 'False') : (i.dataset.value || i.value).trim();
			// Compare old and new value
			if (value !== format('', paragraphXml).trim()) {
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

		// Update view and save paragraph
		if (target.matches('.info')) refresh([paragraphId]);
		savePar([paragraphId]);
	}

	function handleInsertToken(e, sentence, tokenXml, tokenId) {
		let tt = ttip(sel('.cfg', sentence), e, true);
		const form = selToText(tokenXml, 'form');
		tt.innerHTML += `<input type="text" class="input" value="">
			<div class="center">${TOKEN.getLink(tokenId, 'btn token ins-save left',
			'Insert Before <b>%word%</b>').replace('%word%', form)}
			${TOKEN.getLink(tokenId, 'btn token ins-save right', 'Insert After <b>%word%</b>')
			.replace('%word%', form)}</div>`;
	}

	function handleSaveInsertedToken(e, target, paragraphXml, paragraphId, sentenceXml, tokenXml) {
		// Get the new token and validate it
		const input = sel('input', target.closest('.tooltip'));
		const value = input.value.trim();
		if (!value || value.includes(' ')) {
			addMsg(_('Invalid Format'), null, input);
			return;
		}
		// Clone the original token XML
		const newTokenXml = parseXml(tokenXml.outerHTML).documentElement;
		// Create new unique ID, store value and note modified status
		newTokenXml.setAttribute('xml:id', getUID(paragraphXml, tokenXml.getAttribute('xml:id').split('_')[0]));
		const token = sel('word', newTokenXml);
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
		refresh([paragraphId]);
		savePar([paragraphId]);
	}

	function handleDeleteToken(paragraphId, tokenXml) {
		delNode(tokenXml);
		refresh([paragraphId]);
		savePar([paragraphId]);
	}

	function handleSetContent(e, sentence, tokenId) {
		// Display the set content dialog
		let tt = ttip(sel('.cfg', sentence), e, true);
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
		if (!text) {
			addMsg(_('Please provide content'), false, contentInput);
			return;
		}
		if (!apiInputValue) {
			addMsg(_('Please provide API URL'), false, apiInput);
			return;
		}

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
			if (typeof data !== 'string') {
				addMsg(_(data.detail || 'unknown error'), false, contentInput);
				return;
			}
			try {
				// Handle success
				const xml = sel('body', parseXml(data));
				_content[paragraphId] = xml.innerHTML;
				editor.forceReload = true;
				savePar([paragraphId]);
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
		let target = e.target;
		if (!target) return;

		// Cancel new document creation
		if (target && target.matches('.new-cancel')) {
			trg(target.closest('.tooltip'), 'close');
			return;
		}

		const ctx = resolveContext(target, {resolveTableCellParent: true});
		if (!ctx) return;

		// Open tooltip
		if (ctx.target.matches('.t, .cfg'))
			return handleTokenContextMenu(e, ctx.target, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (ctx.target.matches('.show.info')) return handleEditTokenInfo(e, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (ctx.target.matches('.show.meaning')) return handleEditMeaning(e, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (ctx.target.matches('.show.reason')) return handleEditReason(e, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (ctx.target.matches('.save.info,.save.meaning,.save.reason'))
			return handleSaveTokenFields(e, ctx.target, ctx.tokenXml, ctx.paragraphId);

		if (ctx.target.matches('.ins.token')) return handleInsertToken(e, ctx.sentence, ctx.tokenXml, ctx.tokenId);

		if (ctx.target.matches('.ins-save.token'))
			return handleSaveInsertedToken(e, ctx.target, ctx.paragraphXml, ctx.paragraphId, ctx.sentenceXml, ctx.tokenXml);

		if (ctx.target.matches('.del.token')) return handleDeleteToken(ctx.paragraphId, ctx.tokenXml);

		if (ctx.target.matches('.set.content')) return handleSetContent(e, ctx.sentence, ctx.tokenId);

		if (ctx.target.matches('.save.content')) return handleSaveContent(e, ctx.target, ctx.paragraphId)
	});

	function handleSplitToken(paragraphXml, paragraphId, sentenceXml, tokenXml, value) {
		const index = Number(value);
		if (isNaN(index) || index < 0 || index > text.length) return;

		// Select token to modify
		const wordEl = sel('word', tokenXml);
		const text = wordEl.textContent;

		// Split text
		const left = text.slice(0, index);
		const right = text.slice(index);

		// Clone the original token XML
		const newTokenXml = parseXml(tokenXml.outerHTML).documentElement;

		// Create new unique ID, store value and note modified status
		const baseId = tokenXml.getAttribute('xml:id')?.split('_')[0];
		if (baseId) newTokenXml.setAttribute('xml:id', getUID(paragraphXml, baseId));

		const newWordEl = sel('word', newTokenXml);

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
		refresh([paragraphId]);
		savePar([paragraphId]);
	}

	function handleJoinToken(paragraphXml, paragraphId, sentenceXml, tokenXml, tokenId, value) {
		// Find neighbouring token
		let offset = value === '0' ? -1 : 1;
		let tokenXml2 = find('token', sentenceXml)[Number(tokenId) + offset];
		if (!tokenXml2) {
			addMsg(_('Invalid Action'));
			return;
		}

		const [keepToken, removeToken] = offset > 0 ? [tokenXml, tokenXml2] : [tokenXml2, tokenXml];
		const keepWord = sel('word', keepToken);
		const removeWord = sel('word', removeToken);

		// Join text
		keepWord.setAttribute('modified', 'True');
		keepWord.textContent = format('', keepWord) + format('', removeWord);

		// TODO Investigate the ID generation
		// Update IDs and remove second token
		const id1 = keepToken.getAttribute('xml:id').split('_');
		const id2 = removeToken.getAttribute('xml:id').split('_');
		delNode(removeToken);

		if (id1.length > 1) {
			if (id2.length > 1) {
				keepToken.setAttribute('xml:id', getUID(paragraphXml, id1[0]));
			} else {
				keepToken.setAttribute('xml:id', id2[0]);
			}
		}

		// Save changes and refresh UI
		refresh([paragraphId]);
		savePar([paragraphId]);
	}

	function handleSplitSentence(paragraphXml, paragraphId, sentenceXml, tokenId, value) {
		// Determine split point
		const tokenNodes = find('token', sentenceXml);
		const offset = value === '0' ? 0 : 1;
		const splitToken = tokenNodes[Number(tokenId) + offset];
		if (!splitToken || splitToken === tokenNodes[0]) {
			addMsg(_('Invalid Action'));
			return;
		}

		// Preserve indentation
		const indent = sentenceXml.previousSibling?.nodeName === '#text' ? sentenceXml.previousSibling.textContent : '';
		// Mark sentence and insert split marker
		sentenceXml.setAttribute('modified', 'True');
		sentenceXml.insertBefore(paragraphXml.createElement('split'), splitToken);

		// Create new sentence ID
		const root = paragraphXml.documentElement;
		const idBase = sentenceXml.getAttribute('xml:id').split('_')[0];
		const newSentence = `</${sentenceXml.nodeName}>` + indent + `<${sentenceXml.nodeName}`
			+ (idBase ? ` xml:id="${getUID(paragraphXml, idBase)}"` : '') + ' modified="True"> ';

		// Replace marker with sentence boundary
		root.innerHTML = root.innerHTML.replace(/([ \t\r\n]*)<split[^>]*>/, indent + newSentence + '$1');

		// Save changes and refresh UI
		refresh([paragraphId]);
		savePar([paragraphId]);
	}

	function handleJoinSentence(paragraph, paragraphXml, paragraphId, sentenceXml, sentenceId, value) {
		// Determine direction
		const sentences = find('s,l', paragraphXml);
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
				let chunk = editor.renderChunk(adjacentParagraphId);
				if (chunk) paragraph.parentNode.insertBefore(chunk, joinRight ? paragraph.nextSibling : paragraph);
			}
			if (!_active[adjacentParagraphId]) {
				addMsg(_('Invalid Action'));
				return;
			}

			[keepSentence, removeSentence] = joinRight ? [sentenceXml, sel('s', _active[adjacentParagraphId])]
				: [sel('s:last-of-type', _active[adjacentParagraphId]), sentenceXml];
			paragraphIds = joinRight ? [paragraphId, adjacentParagraphId] : [adjacentParagraphId, paragraphId];
		}
		if (!keepSentence || !removeSentence) {
			addMsg(_('Invalid Action'));
			return;
		}

		// Merge sentences
		keepSentence.setAttribute('modified', 'True');
		keepSentence.innerHTML = keepSentence.innerHTML.replace(/[ \r\n\t]+$/, '') + removeSentence.innerHTML;


		// Update IDs
		const id1 = keepSentence.getAttribute('xml:id').split('_');
		const id2 = removeSentence.getAttribute('xml:id').split('_');

		delNode(removeSentence);

		if (id1.length > 1) {
			if (id2.length > 1) {
				keepSentence.setAttribute('xml:id', '');
				keepSentence.setAttribute('xml:id', getUID(paragraphXml, id1[0]));
			} else {
				keepSentence.setAttribute('xml:id', id2[0]);
			}
		}

		refresh([paragraphIds[0]]);
		savePar(paragraphIds);
	}

	function handleMoveSentence(paragraph, paragraphXml, paragraphId, sentenceXml, sentenceId, value) {
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
		const isLastSentence = sentenceId === find('s,l', paragraphXml).length - 1;
		const isFirstSentence = sentenceId === 0;
		if (!_active[adjacentParagraphId] || (moveToNextParagraph && !isLastSentence) || (offset < 0 && !isFirstSentence)) {
			addMsg(_('Invalid Action'));
			return;
		}

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

	document.addEventListener('change', function (e) {
		let target = e.target;
		if (!target) return;

		const ctx = resolveContext(target, {includeValue: true});
		if (!ctx) return;

		if (target.matches('.split.token'))
			return handleSplitToken(target, ctx.paragraphXml, ctx.paragraphId, ctx.sentenceXml, ctx.tokenXml, ctx.value)

		if (target.matches('.join.token'))
			return handleJoinToken(ctx.paragraphXml, ctx.paragraphId, ctx.sentenceXml, ctx.tokenXml, ctx.tokenId, ctx.value)

		if (target.matches('.split.sent'))
			return handleSplitSentence(ctx.paragraphXml, ctx.paragraphId, ctx.sentenceXml, ctx.tokenId, ctx.value);

		if (target.matches('.join.sent'))
			return handleJoinSentence(ctx.paragraph, ctx.paragraphXml, ctx.paragraphId, ctx.sentenceXml, ctx.sentenceId,
				ctx.value);

		if (target.matches('.move.sent'))
			return handleMoveSentence(ctx.paragraph, ctx.paragraphXml, ctx.paragraphId, ctx.sentenceXml, ctx.sentenceId,
				ctx.value);
	});

	function normalizeDocumentTitle(xml, filename) {
		// Derive a title from the filename
		const title = filename.replace(/\.xml$/i, '');
		if (!title) return xml;
		// If there is a title tag replace with the value of title else return the XML unchanged
		return xml.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${encXml(title)}</title>`);
	}

	Editor.registerNewDocumentType('metaphor', function () {
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

				if (!filename || !api || !content) {
					addMsg(_('Please fill in all fields'), 'error', tt);
					return;
				}

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
