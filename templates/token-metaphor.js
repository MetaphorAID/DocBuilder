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

	function getContext(target) {
		// Only handle clicks within paragraph containers
		const paragraph = target.closest('.par.tei');
		if (!paragraph) return null;

		// Normalize target for table view
		if (localStorage.tableview && target.classList.contains('as-parent')) target = target.parentNode;

		// Only handle clicks on elements inside sentences (.s)
		const sentence = target.closest('.s');  // TODO Normalized s before return or unnormalised in the original code?
		if (!sentence) return null;

		const paragraphId = Number(paragraph.dataset.cid);
		const sentenceId = Number(sentence.dataset.sid);

		const paragraphXml = _active[paragraphId];
		const sentenceXml = find('s,l', paragraphXml)[sentenceId];

		const tokenId = target.dataset.tid;
		const tokenXml = tokenId ? find('token', sentenceXml)[tokenId] : null;

		return {target, paragraph, sentence, paragraphId, sentenceId, paragraphXml, sentenceXml, tokenId, tokenXml};
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
		let tt = ttip(ctx.target, e);
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
		tt.innerHTML += `<textarea name="reasoning" class="input">
			${encXml(format('', sel('reasoning', tokenXml)))}</textarea>
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

	document.addEventListener('click', function (e) {
		let target = e.target;
		if (!target) return;

		// Cancel new document creation
		if (target && target.matches('.new-cancel')) {
			trg(t.closest('.tooltip'), 'close');
			return;
		}

		const ctx = getContext(target);
		if (!ctx) return;

		// Open tooltip
		if (t.matches('.t, .cfg')) return handleTokenContextMenu(e, ctx.target, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (t.matches('.show.info')) return handleEditTokenInfo(e, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (t.matches('.show.meaning')) return handleEditMeaning(e, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (t.matches('.show.reason')) return handleEditReason(e, ctx.tokenXml, ctx.tokenId, ctx.sentence);

		if (t.matches('.save.info,.save.meaning,.save.reason'))
			return handleSaveTokenFields(e, ctx.target, ctx.tokenXml, ctx.paragraphId);

		if (t.matches('.ins.token')) return handleInsertToken(e, ctx.sentence, ctx.tokenXml, ctx.tokenId);

		if (t.matches('.ins-save.token'))
			return handleSaveInsertedToken(e, ctx.target, ctx.paragraphXml, ctx.paragraphId, ctx.sentenceXml, ctx.tokenXml);

		if (t.matches('.del.token')) return handleDeleteToken(ctx.paragraphId, ctx.tokenXml);

		if (t.matches('.set.content')) return handleSetContent(e, ctx.sentence, ctx.tokenId);

		if (t.matches('.save.content')) return handleSaveContent(e, ctx.target, ctx.paragraphId)
	});

	document.addEventListener('change', function (e) {
		let t = e.target;
		if (!t) return;

		// Only handle changes within paragraph containers
		let c = t.closest('.par.tei');
		if (!c) return;

		// Only handle changes on elements inside sentences (.s)
		if (!t.closest('.s')) return;

		let cid = parseInt(c.dataset.cid);
		let x = _active[cid];
		let s = t.closest('.s');
		let sid = parseInt(s.dataset.sid);
		let xsl = find('s,l', x);
		let xs = xsl[sid];
		let tid = t.dataset.tid;
		let xtl = find('token', xs);
		let xt = tid ? xtl[tid] : false;

		let val = t.dataset.value || t.value;
		if (t.classList.contains('multiple')) val = JSON.parse(t.dataset.value);

		if (t.matches('.split.token')) {
			if (val === '') return;
			let tkn = sel('word', xt);
			tkn.setAttribute('modified', 'True');
			let xt2 = parseXml(xt.outerHTML).documentElement;
			sel('word', xt2).textContent = tkn.textContent.slice(Number(val));
			let id1 = xt.getAttribute('xml:id');
			if (id1) xt2.setAttribute('xml:id', getUID(x, id1.split('_')[0]));
			tkn.textContent = tkn.textContent.slice(0, Number(val));
			xs.insertBefore(xt2, xt.nextSibling);
			if (xt.previousSibling && xt.previousSibling.nodeName === '#text') {
				xs.insertBefore(x.createTextNode(xt.previousSibling.textContent), xt.nextSibling);
			}
			refresh([cid]);
			savePar([cid]);
			return;
		}

		if (t.matches('.join.token')) {
			if (val === '') return;
			let off = val === '0' ? -1 : 1;
			let xt2 = xtl[parseInt(tid) + off];
			if (!xt2) {
				addMsg(_('Invalid Action'));
				return;
			}
			let u = off > 0 ? [xt, xt2] : [xt2, xt];
			let tkn = sel('word', u[0]);
			tkn.setAttribute('modified', 'True');
			tkn.textContent = format('', sel('word', u[0])) + format('', sel('word', u[1]));
			let id2 = u[1].getAttribute('xml:id').split('_');
			delNode(u[1]);
			let id1 = u[0].getAttribute('xml:id').split('_');
			if (id1.length > 1) {
				if (id2.length > 1) {
					u[0].setAttribute('xml:id', '');
					u[0].setAttribute('xml:id', getUID(x, id1[0]));
				} else {
					u[0].setAttribute('xml:id', id2[0]);
				}
			}
			refresh([cid]);
			savePar([cid]);
			return;
		}

		if (t.matches('.split.sent')) {
			if (val === '') return;
			let xt2 = xtl[parseInt(tid) + (val === '0' ? 0 : 1)];
			if (!xt2 || xt2 === xtl[0]) {
				addMsg(_('Invalid Action'));
				return;
			}
			let indent = xs.previousSibling && xs.previousSibling.nodeName === '#text' ? xs.previousSibling.textContent : '';
			xs.setAttribute('modified', 'True');
			xs.insertBefore(x.createElement('split'), xt2);
			let xe = x.documentElement;
			let id = xs.getAttribute('xml:id').split('_')[0];
			xe.innerHTML = xe.innerHTML.replace(/([ \t\r\n]*)<split[^>]*>/
				, indent + '</' + xs.nodeName + '>' + indent + '<' + xs.nodeName + (id ? ' xml:id="'
				+ getUID(x, id) + '"' : '') + ' modified="True"> $1');
			refresh([cid]);
			savePar([cid]);
			return;
		}

		if (t.matches('.join.sent')) {
			if (val === '') return;
			let off = val === '0' ? -1 : 1;
			let u, cids;
			if (xsl[sid + off]) {
				u = off > 0 ? [xs, xsl[sid + off]] : [xsl[sid + off], xs];
				cids = [cid];
			} else {
				if (!_active[cid + off]) {
					let e = editor.renderChunk(cid + off);
					if (e) c.parentNode.insertBefore(e, off > 0 ? c.nextSibling : c);
				}
				if (!_active[cid + off]) {
					addMsg(_('Invalid Action'));
					return;
				}
				u = off > 0 ? [xs, sel('s', _active[cid + off])] : [sel('s:last-of-type', _active[cid + off]), xs];
				cids = off > 0 ? [cid, cid + off] : [cid + off, cid];
			}
			if (!u[0] || !u[1]) {
				addMsg(_('Invalid Action'));
				return;
			}
			u[0].setAttribute('modified', 'True');
			u[0].innerHTML = u[0].innerHTML.replace(/[ \r\n\t]+$/, '') + u[1].innerHTML;
			let id2 = u[1].getAttribute('xml:id').split('_');
			delNode(u[1]);
			let id1 = u[0].getAttribute('xml:id').split('_');
			if (id1.length > 1) {
				if (id2.length > 1) {
					u[0].setAttribute('xml:id', '');
					u[0].setAttribute('xml:id', getUID(x, id1[0]));
				} else {
					u[0].setAttribute('xml:id', id2[0]);
				}
			}
			refresh([cids[0]]);
			savePar(cids);
			return;
		}

		if (t.matches('.move.sent')) {
			if (val === '') return;
			let off = val === '0' ? -1 : 1;
			if (!_active[cid + off]) {
				let e = editor.renderChunk(cid + off);
				if (e) c.parentNode.insertBefore(e, off > 0 ? c.nextSibling : c);
			}
			if (!_active[cid + off] || (off > 0 && xsl.length > sid + 1) || (off < 0 && sid > 0)) {
				addMsg(_('Invalid Action'));
				return;
			}
			let x2 = _active[cid + off].documentElement
			if (off > 0) {
				x2.innerHTML = x2.innerHTML.replace(/([ \t\r\n]*)</, '$1' + xs.outerHTML + '$1<');
			} else {
				let indent = xs.previousSibling
				&& xs.previousSibling.nodeName === '#text' ? xs.previousSibling.textContent : '';
				x2.innerHTML = x2.innerHTML.replace(/([ \t\r\n]*)$/, indent + xs.outerHTML + '$1');
			}
			delNode(xs);
			savePar(off > 0 ? [cid, cid + off] : [cid + off, cid]);
		}
	});

	function normalizeDocumentTitle(xml, filename) {
		let title = filename.replace(/\.xml$/i, '');
		if (!title) return xml;
		if (/<title\b[^>]*>/i.test(xml)) {
			return xml.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '<title>' + encXml(title) + '</title>');
		}
		return xml;
	}

// Add new method for creating new metaphor documents
	TOKEN.new = function () {
		return new Promise((resolve, reject) => {
			let tt = ttip(sel('header'), null, true);
			tt.innerHTML = '<h3 style="text-align: center;">' + _('New Text for Metaphor Detection') + '</h3>' +
				'<input type="text" name="filename" class="input" placeholder="' + _('File Name') + '" value="uj-metafora-'
				+ new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace(/Z$/, '') + '.xml">' +
				'<input type="url" name="api" class="input" placeholder="API URL" value="'
				+ (localStorage['metaphor_api'] || '') + '">' +
				'<input type="password" name="token" class="input" placeholder="API Token" value="'
				+ (localStorage['metaphor_token'] || '') + '">' +
				'<textarea name="content" class="input" placeholder="' + _('Content') + '"></textarea>' +
				'<div class="center">' +
				'<a href="#" class="btn metaphor-new-submit">' + _('Submit') + '</a>' +
				'<a href="#" class="btn metaphor-new-cancel">' + _('Cancel') + '</a>' +
				'</div>';

			// Set minimum height for the modal to fit content
			tt.style.minHeight = '400px';
			tt.style.display = 'flex';
			tt.style.flexDirection = 'column';

			// Handle the submit button
			let submitBtn = sel('.metaphor-new-submit', tt);
			let cancelBtn = sel('.metaphor-new-cancel', tt);

			cancelBtn.addEventListener('click', function () {
				trg(tt, 'close');
				resolve(null);
			});

			submitBtn.addEventListener('click', function () {
				let filename = sel('[name="filename"]', tt).value.trim();
				let api = sel('[name="api"]', tt).value.trim();
				let token = sel('[name="token"]', tt).value.trim();
				let content = sel('[name="content"]', tt).value.trim();

				if (!filename || !content || !api) {
					addMsg(_('Please fill in all fields'), 'error', tt);
					return;
				}
				if (!filename.toLowerCase().endsWith('.xml')) {
					filename += '.xml';
				}

				localStorage['metaphor_api'] = api;
				localStorage['metaphor_token'] = token;

				// Show loading state
				let originalText = submitBtn.textContent;
				submitBtn.textContent = _('Processing...');
				submitBtn.classList.add('disabled');

				fetch(api, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Authorization': 'Bearer ' + token
					},
					body: JSON.stringify({text: content})
				}).then(r => {
					// Check for authentication errors first
					if (r.status === 401) {
						return Promise.reject(new Error(_('Invalid bearer token')));
					}
					if (!r.ok) {
						return r.json().then(err => {
							return Promise.reject(new Error(err.detail || err.message || _('API server error')));
						}).catch(e => {
							// If JSON parsing fails, return status error
							return Promise.reject(new Error(_('API server error')));
						});
					}
					return r.text();
				}).then(function (data) {
					if (typeof data == 'string') {
						trg(tt, 'close');
						resolve([filename, normalizeDocumentTitle(data, filename)]);
					} else {
						addMsg(data.detail || _('unknown error'), 'error', tt);
						submitBtn.textContent = originalText;
						submitBtn.classList.remove('disabled');
					}
				}).catch(err => {
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
				});
			});
		});
	};
})();
