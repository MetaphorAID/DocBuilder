(function () {
	const EMTSV_URL = 'https://emtsv.elte-dh.hu/morph'; // TODO set as the metaphora API URL

	Locale['Detailed'] = 'Részletes';
	Locale['Simple'] = 'Egyszerű';
	Locale['Re-Analyze'] = 'Új elemzés';
	Locale['Select Ana.'] = 'Elemzés választása';
	Locale['No Selected Analyzation'] = 'Nincs kiválasztva elemzés';

	const _active = {};
	const _cols = {};

	Editor.TYPES.x_s = {
		remove: function (input, chunk) {
			delete _active[input.dataset.cid];
		},
		getValue: function (input, chunk) {
			const x = _active[input?.dataset.cid];
			return x ? stringifyTsv(x) : chunk.value;
		},
		render: function (chunk, cid) {
			if (!_cols.length && editor.hidden[0]) {
				const cols = editor.hidden[0].value.split('\t');
				cols.forEach((name, i) => _cols[name] = i);

				for (const name of ['lemma', 'xpostag', 'verified']) _cols[name] ??= cols.push(name) - 1;

				_cols._length = cols.length;
				_cols._header = cols.join('\t');
			}

			// Parse the TSV to paragraph format
			const x = parseTsv(chunk.value);
			_active[Number(cid)] = x;
			const ep = renderPar(x);

			// Empty paragraph handling
			if (!ep.children.length) {
				ep.innerHTML = chunk.value || `<em>${_('EMPTY')}</em>`;
			} else {
				ep.classList.add('par', 'xtsv');
			}
			return ep;
		},
	};

	function getToken(token) {
		return token[_cols['form']] || '';
	}

	function getAnas(token) {
		const value = token[_cols['anas']];
		if (!value) return [];

		try {
			return JSON.parse(value) || [];
		} catch (e) {
			console.error(e);
			return [];
		}
	}

	function getLemma(token) {
		return token[_cols['lemma']] || '';
	}

	function getPosTag(token) {
		return token[_cols['xpostag']] || '';
	}

	function getVerified(token) {
		return parseInt(token[_cols['verified']]) || 0;
	}

	function resetToken(token, value) {
		token[_cols['form']] = value;
		token[_cols['anas']] = token[_cols['lemma']] = token[_cols['xpostag']] = '';
		token[_cols['verified']] = 0;
	}

	function setAna(token, lemma, postag) {
		token[_cols['lemma']] = lemma;
		token[_cols['xpostag']] = postag;
		token[_cols['verified']] = lemma ? 1 : 0;
	}

	function stringifyTsv(tokens) {
		return tokens.map(t => t.join('\t')).join(editor.eol);
	}

	function parseTsv(text) {
		return text.split(editor.eol).map(line => line.split('\t'));
	}

	function selectedAna(anas, token) {
		const lemma = getLemma(token);
		if (!lemma) return anas[0] || false;
		const tag = getPosTag(token);
		return anas.find(a => a.lemma === lemma && a.tag === tag) || {lemma, tag, custom: true};
	}

	function createTdElement(content = '&nbsp;', className = 'as-parent') {
		const el = document.createElement('td');
		el.className = className;
		el.innerHTML = content;
		return el;
	}

	function renderToken(token, tid, tableView) {
		// Create word element
		const wordEl = document.createElement(tableView ? 'tr' : 'span');
		wordEl.className = 't';

		// Add joins if needed
		const joinType = ''; // sticky token ?
		if (['left', 'both'].includes(joinType)) wordEl.classList.add('left');
		if (['right', 'both'].includes(joinType)) wordEl.classList.add('right');
		wordEl.dataset.tid = tid;
		const anas = getAnas(token);
		if (!getVerified(token)) {
			wordEl.classList.add('unchecked');
			if (anas.length === 1) wordEl.classList.add('single');
		}

		if (tableView) {
			wordEl.appendChild(createTdElement(getToken(token)));
			const ana = selectedAna(anas, token);
			wordEl.appendChild(createTdElement(ana?.lemma));
			wordEl.appendChild(createTdElement(ana?.readable));
			wordEl.appendChild(createTdElement(ana?.tag));

			if (ana) {
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
			wordEl.innerHTML = getToken(token) || '&nbsp;';
		}
		return wordEl;
	}

	function renderSent(tokens, tableView) {
		// Create and setup sentence element
		let sentenceEl = document.createElement(tableView ? 'table' : 'div');
		sentenceEl.className = 's';

		if (tableView) {
			const tbody = document.createElement('tbody');
			tbody.appendChild(TOKEN.createHeaderRow(TOKEN.MORPH_HEADERS));
			sentenceEl.appendChild(tbody);
			// Change from <table> to <tbody>
			sentenceEl = sentenceEl.children[0];
		}
		// Put each token into the sentence element
		each(tokens, function (token, tid) {
			if (!token[0] && token.length < 2) return;

			const renderedToken = renderToken(token, tid, tableView);

			if (renderedToken) sentenceEl.appendChild(renderedToken);
		});

		// Create the config row for the sentence
		const row = TOKEN.createSettingsRow(tableView, TOKEN.MORPH_HEADERS.length);
		sentenceEl.appendChild(row);

		return tableView ? sentenceEl.parentNode : sentenceEl;
	}

	function renderPar(tokens) {
		// Create paragraph element
		const tableView = localStorage.tableview;
		const root = document.createElement('div');
		if (tableView) root.className = 'table';

		// Put sentences into the paragraph element
		root.appendChild(renderSent(tokens, tableView));

		return root;
	}

	function savePar(paragraphIds) {
		// Annotations are considered hidden data, commit changes
		const hdata = {};
		const hidden = editor.hidden[0];
		if (hidden && (hidden.value !== _cols._header)) hdata[0] = _cols._header;
		return editor.onchange(paragraphIds, hdata);
	}

	// function updJoin(tokenId, tokens) {
	// 	const left = tokenId > 0 && ['right', 'both'].includes(tokens[tokenId - 1].getAttribute('join'));
	// 	const right = tokenId < tokens.length - 1 && ['left', 'both'].includes(tokens[tokenId + 1].getAttribute('join'));
	// 	let join = 'no';
	// 	if (left && right) join = 'both';
	// 	else if (left) join = 'left';
	// 	else if (right) join = 'right';
	//
	// 	tokens[tokenId].setAttribute('join', join);
	// }

	function updAna(tokens, paragraphId) {
		// Recursively process (to force sequential processing) all tokens in the paragraph
		const token = tokens.shift();
		const formData = new FormData();
		formData.append('file', new Blob([`form\n${getToken(token)}\n`], {type: 'text/plain'}), 'input.txt');
		fetch(EMTSV_URL, {method: 'POST', body: formData})
			.then(r => r.text()).then(data => {
			token[_cols['anas']] = data.replace(/^[^\r\n]*[\r\n]+[^\t]*\t/, '').trim();
			setAna(token, '', '');
			if (tokens.length) {
				updAna(tokens, paragraphId);
			} else {
				savePar([paragraphId]);
			}
		});
	}

	function resolveParagraphContext(target) {
		// Only handle events within paragraph containers
		const paragraph = target.closest('.par.xtsv');
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

		const sentenceId = null;  // Number(sentence.dataset.sid);
		const sentences = null;  // find('s,l', paragraphCtx.paragraphXml);
		const sentenceXml = null;  // sentences[sentenceId];

		// if (!sentenceXml) return null;

		const tokenId = target.dataset.tid;
		const tokens = paragraphCtx.paragraphXml;
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
		if (tokenXml) { // Token
			// Set the current tooltip active
			target.classList.add('active');

			// Setup elements
			html += TOKEN.getLink(tokenId, 'edit ana', 'Select Ana.');

			// Setup possible token splittings
			const tkn = getToken(tokenXml);
			if (tkn.length > 1) {
				const split = {};
				for (let i = 1; i < tkn.length; ++i) split[i] = encXml(tkn.slice(0, i)) + ' | ' + encXml(tkn.slice(i));
				html += TOKEN.getSelect(tokenId, 'split token', '', 'Split Token...', split);
			}
			// Setup other elements
			html += TOKEN.getLink(tokenId, 'edit token', 'Fix Token'); // Change the value freely
			html += TOKEN.getSelect(tokenId, 'join token', '', 'Join Token...', TOKEN.SEL_WHERE);
			html += TOKEN.getLink(tokenId, 'ins token', 'Insert Token');
			html += TOKEN.getLink(tokenId, 'del token', 'Delete Token');
			html += TOKEN.getSelect(tokenId, 'split sent', '', 'Split Sentence...', TOKEN.SEL_WHERE);
		} else {
			// Setup elements for the cogwheel (sentence-wide) menu
			sentence.classList.add('active');
			html += TOKEN.getSelect(tokenId, 'join sent', '', 'Join Sentence...', TOKEN.SEL_WHERE);
		}

		// Show the tooltip a dropdown menu
		const tt = ttip(target, e);
		tt.classList.add('dropdown');
		tt.innerHTML = html;
	}

	function handleEditAna(e, sentence, tokenId, tokenXml) {
		const btn = (tid, anaId = '', selected = false) =>
			`<a href="#" data-tid="${tid}" data-ana="${anaId}" class="btn selAna ${selected ? 'selected' : ''}">✓</a>`;
		const headers = TOKEN.MORPH_HEADERS;
		const rows = [];

		// Existing analyses
		each('ana', (anaXml, anaId) => {
			if (anaXml.getAttribute('modified') === 'True') return;
			rows.push([selToText(anaXml, 'lemma'), selToText(anaXml, 'detailed'), selToText(anaXml, 'simple'),
				btn(tokenId, anaId, anaXml.getAttribute('correct') === 'True')]);
		}, tokenXml);

		// Modified / Editable ana
		const anas = getAnas(tokenXml);
		const ana = selectedAna(anas, tokenXml) || {};
		rows.push([
			`<input class="input" type="text" value="${ana.custom ? ana.lemma : ''}">`,
			'&nbsp;',
			`<input class="input" type="text" value="${ana.custom ? ana.tag : ''}">`,
			`<input class="input" type="text" value="${ana.custom ? 'selected' : ''}">`,
			btn(tokenId, '', !!ana)
		]);

		const tt = ttip(sel('.cfg', sentence), e, true);
		tt.insertAdjacentHTML('beforeend', `<h3 class="tkn">${_(headers[0])}: <strong>${getToken(tokenXml)}</strong></h3>`);
		tt.appendChild(TOKEN.createTable(headers.slice(1), rows));
		tt.insertAdjacentHTML('beforeend', `<div class="center">${TOKEN.getLink(tokenId, 'btn ana fetch', 'Re-Analyze')
		}${TOKEN.getLink(tokenId, 'btn ana save', 'Save')}</div>`);

		evt('table input', 'focus', function () {
			trg('.btn', 'click', this.closest('tr'));
		}, tt);
	}

	function handleSelAna(target, paragraphId, tokenXml) {
		const anas = getAnas(tokenXml);
		// If default
		if (target.dataset.ana === 'default') {
			const ana = selectedAna(anas, tokenXml);
			setAna(tokenXml, ana.lemma, ana.tag);
			savePar([paragraphId]);
			return;
		}
		// Remove existing selected
		each('.btn.selAna', b => b.classList.remove('selected'), target.closest('table'));

		// Add the new selected
		target.classList.add('selected');
	}

	function handleSaveAna(target, paragraphId, tokenXml) {
		const tooltip = target.closest('.tooltip');
		const selected = sel('.selAna.selected', tooltip);
		if (!selected) return addMsg(_('No Selected Analyzation'), null, tooltip);
		if (selected.dataset.ana) {
			const anas = getAnas(tokenXml);
			const ana = anas[selected.dataset.ana];
			setAna(tokenXml, ana ? ana.lemma : '', ana ? ana.tag : '');
		} else {
			const input = find('input', selected.closest('tr'));
			const lemma = input[0].value.trim();
			const postag = input[1].value.trim();
			if (!lemma.length || lemma.includes(' ')) return addMsg(_('Invalid Format'), null, input[0]);
			setAna(tokenXml, lemma, postag);
		}
		savePar([paragraphId]);
	}

	function handleEditToken(e, sentence, tokenId, tokenXml) {
		const html = `<input type="text" class="input" value="${getToken(tokenXml)}"><div class="center">${
			TOKEN.getLink(tokenId, 'btn token save', 'Save')}</div>`;

		ttip(sel('.cfg', sentence), e, true).innerHTML += html;
	}

	function handleSaveToken(target, paragraphId, tokenXml) {
		const tooltip = target.closest('.tooltip');
		const input = sel('input', tooltip);
		const value = input.value.trim();

		// No change -> just close
		if (getToken(tokenXml) === value) return trg(tooltip, 'close');

		// Validation
		if (!value || value.includes(' ')) return addMsg(_('Invalid Format'), null, input);

		resetToken(tokenXml, value);
		updAna([tokenXml], paragraphId);
	}

	function handleInsertToken(e, sentence, tokenId, tokenXml) {
		const tt = ttip(sel('.cfg', sentence), e, true);
		const form = getToken(tokenXml);
		// Both insert buttons use the same value; the button only selects the insertion side
		tt.innerHTML += `<input type="text" class="input" value=""><div class="center">${
			TOKEN.getLink(tokenId, 'btn token ins-save left', 'Insert Before <b>%word%</b>', null, {word: form})}${
			TOKEN.getLink(tokenId, 'btn token ins-save right', 'Insert After <b>%word%</b>', null, {word: form})}</div>`;
	}

	function handleSaveInsertedToken(target, paragraphId, paragraphXml, tokenId) {
		// Get the new token and validate it
		const input = sel('input', target.closest('.tooltip'));
		const value = input.value.trim();

		// Validation
		if (!value || value.includes(' ')) return addMsg(_('Invalid Format'), null, input);

		// Clone the original token XML
		const newTokenId = Number(tokenId) + (target.classList.contains('left') ? 0 : 1);
		const newTokenXml = [];
		resetToken(newTokenXml, value);
		paragraphXml.splice(newTokenId, 0, newTokenXml);
		updAna([paragraphXml[newTokenId]], paragraphId);
	}

	document.addEventListener('click', e => {
		const target = e.target;
		if (!target) return;

		const ctx = resolveContext(target, {resolveTableCellParent: true});
		if (!ctx) return;

		// Open tooltip
		if (ctx.target.matches('.t, .cfg'))
			return handleTokenContextMenu(e, ctx.target, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.edit.ana')) return handleEditAna(e, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.selAna')) return handleSelAna(ctx.target, ctx.paragraphId, ctx.tokenXml);

		if (ctx.target.matches('.save.ana')) return handleSaveAna(ctx.target, ctx.paragraphId, ctx.tokenXml);

		if (ctx.target.matches('.fetch.ana')) return updAna([ctx.tokenXml], ctx.paragraphId);

		if (ctx.target.matches('.edit.token')) return handleEditToken(e, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.save.token')) return handleSaveToken(ctx.target, ctx.paragraphId, ctx.tokenXml);

		if (ctx.target.matches('.ins.token')) return handleInsertToken(e, ctx.sentence, ctx.tokenId, ctx.tokenXml);

		if (ctx.target.matches('.ins-save.token'))
			return handleSaveInsertedToken(ctx.target, ctx.paragraphId, ctx.paragraphXml, ctx.tokenId);

		if (target.matches('.del.token')) {
			delete ctx.paragraphXml[ctx.tokenId];
			savePar([ctx.paragraphId]);
		}

	});

	// function handleEditSticky(paragraphId, tokens, tokenId, tokenXml) {
	// 	const tokenIdNum = Number(tokenId);
	// 	tokenXml.setAttribute('join', value);
	// 	if (tokenIdNum > 0) updJoin(tokenIdNum - 1, tokens);
	// 	if (tokenIdNum < tokens.length - 1) updJoin(tokenIdNum + 1, tokens);
	// 	savePar([paragraphId]);
	// }

	function handleSplitToken(paragraphId, paragraphXml, tokenId, tokenXml, value) {
		const newTokenXml2 = [];
		resetToken(newTokenXml2, getToken(tokenXml).slice(0, value));
		resetToken(tokenXml, getToken(tokenXml).slice(value));
		paragraphXml.splice(tokenId, 0, newTokenXml2);

		updAna([tokenXml, paragraphXml[Number(tokenId) + 1]], paragraphId);
	}

	function handleJoinToken(paragraphId, paragraphXml, tokenId, tokenXml, value) {
		// Find neighbouring token
		const joinRight = value !== '0';
		const offset = joinRight ? 1 : -1;
		const tokenXml2 = paragraphXml[Number(tokenId) + offset];
		if (!tokenXml2) return addMsg(_('Invalid Action'));

		resetToken(tokenXml, joinRight ? (getToken(tokenXml) + getToken(tokenXml2)) :
			(getToken(tokenXml2) + getToken(tokenXml)));
		delete paragraphXml[Number(tokenId) + offset];

		updAna([tokenXml], paragraphId);
	}

	function handleSplitSentence(paragraphId, paragraphXml, tokenId, value) {
		// Determine split point
		const offset = value === '0' ? 0 : 1;
		paragraphXml.splice(Number(tokenId) + offset, 0, ['']);

		savePar([paragraphId]);
	}

	function handleJoinSentence(paragraph, paragraphId, value) {
		// Determine direction
		const joinRight = value !== '0';
		const offset = joinRight ? 1 : -1;
		let adjacentParagraphId = paragraphId + offset;
		if (adjacentParagraphId < 0) return;

		if (!_active[adjacentParagraphId]) {
			const chunk = editor.renderChunk(adjacentParagraphId);
			if (chunk) paragraph.parentNode.insertBefore(chunk, joinRight ? paragraph.nextSibling : paragraph);
		}
		if (!_active[adjacentParagraphId]) return addMsg(_('Invalid Action'));

		adjacentParagraphId = Math.max(paragraphId, adjacentParagraphId);
		if (_active[adjacentParagraphId][0].length < 2) {
			_active[adjacentParagraphId].shift();
			savePar([adjacentParagraphId]);
		}
	}

	document.addEventListener('change', e => {
		const target = e.target;
		if (!target) return;

		const ctx = resolveContext(target, {resolveTableCellParent: true});
		if (!ctx) return;

		// Token stuff
		// if (t.matches('.edit.sticky')) return handleEditSticky(ctx.paragraphId, ctx.tokens, ctx.tokenId, ctx.tokenXml);

		if (target.matches('.split.token'))
			return handleSplitToken(ctx.paragraphId, ctx.paragraphXml, ctx.tokenId, ctx.tokenXml, ctx.value);

		if (target.matches('.join.token'))
			return handleJoinToken(ctx.paragraphId, ctx.paragraphXml, ctx.tokenId, ctx.tokenXml, ctx.value);

		// Sentence stuff
		if (target.matches('.split.sent'))
			return handleSplitSentence(ctx.paragraphId, ctx.paragraphXml, ctx.tokenId, ctx.value);

		if (target.matches('.join.sent')) return handleJoinSentence(ctx.paragraph, ctx.paragraphId, ctx.value);
	});
})();
