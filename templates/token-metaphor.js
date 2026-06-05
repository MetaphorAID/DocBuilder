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
			_active[parseInt(cid)] = x;
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

	document.addEventListener('click', function (e) {
		let t = e.target;
		if (!t) return;

		if (t && t.matches('.new-cancel')) {
			trg(t.closest('.tooltip'), 'close');
			return;
		}

		// Only handle clicks within paragraph containers
		let c = t.closest('.par.tei');
		if (!c) return;

		// Only handle clicks on elements inside sentences (.s)
		if (!t.closest('.s')) return;

		if (localStorage.tableview && t.classList.contains('as-parent')) t = t.parentNode;

		let cid = parseInt(c.dataset.cid);
		let x = _active[cid];
		let s = t.closest('.s');
		let sid = parseInt(s.dataset.sid);
		let xsl = find('s,l', x);
		let xs = xsl[sid];
		let tid = t.dataset.tid;
		let xtl = find('token', xs);
		let xt = tid ? xtl[tid] : false;

		// open tooltip
		if (t.matches('.t, .cfg')) {
			each('.par .active', function (i) {
				i.classList.remove('active');
			});
			let html = '';
			if (xt) { //token
				t.classList.add('active');
				html += TOKEN.getLink(tid, 'show info', 'Edit');
				html += TOKEN.getLink(tid, 'show meaning', 'Meanings');
				if (format('', sel('reasoning', xt))) {
					html += TOKEN.getLink(tid, 'show reason', 'Reasoning');
				}
				let tkn = format('', sel('word', xt));
				if (tkn.length > 1) {
					let split = {};
					for (let i = 1; i < tkn.length; ++i) {
						split[i] = encXml(tkn.slice(0, i)) + ' | ' + encXml(tkn.slice(i));
					}
					html += TOKEN.getSelect(tid, 'split token', '', 'Split Token...', split);
				}
				html += TOKEN.getSelect(tid, 'join token', '', 'Join Token...', TOKEN.SEL_WHERE);
				html += TOKEN.getLink(tid, 'ins token disabled', 'Insert Token');
				html += TOKEN.getLink(tid, 'del token disabled', 'Delete Token');
			} else {
				s.classList.add('active');
			}
			if (xt) {
				html += TOKEN.getSelect(tid, 'split sent', '', 'Split Sentence...', TOKEN.SEL_WHERE);
			} else {
				html += TOKEN.getSelect(tid, 'join sent', '', 'Join Sentence...', TOKEN.SEL_WHERE);
				html += TOKEN.getSelect(tid, 'move sent', '', 'Move Sentence...', TOKEN.SEL_WHERE);
				html += TOKEN.getLink(tid, 'set content', 'Set Paragraph...');
			}

			let tt = ttip(t, e);
			tt.classList.add('dropdown');
			tt.innerHTML = html;
			return;
		}

		if (t.matches('.show.info')) {
			let tt = ttip(sel('.cfg', s), e, true);
			let html = ['', ''];
			for (const f in COLS) {
				let td = '';
				switch (f) {
					case 'word':
					case 'lemma':
					case 'pos':
					case 'nerTag':
						td = '<input type="text" name="' + f + '" class="input" value="' + format('', sel(f, xt)) + '">';
						break;
					case 'meanings':
						// let v = format(f, sel(f, xt));
						// html += (format('', sel('primary', xt)) + '\n' + format('', sel('other', xt))).replace(v, '<strong>'
						// + v + '</strong>').replaceAll('\n', '<br>');
						break;
					case 'comment':
						td = '<textarea name="' + f + '" class="input">' + encXml(format('', sel(f, xt))) + '</textarea>';
						break;
					case 'metaphor':
						td = '<input type="checkbox" name="' + f + '" class="input" value="True"'
							+ ('True' === format('', sel(f, xt)) ? ' checked' : '') + '>';
						break;
					case 'otherIndirect':
						let el = sel(f, xt);
						let value = el ? el.textContent.trim() : '';
						if (value === 'None' || value === 'none' || !INDIRECT[value]) value = '0';
						let s = select(value, '', INDIRECT);
						s.className += ' input';
						s.dataset.name = f;
						td = s.outerHTML;
						break;
					default:
						td = format(f, sel(f, xt));
				}
				if (td) {
					html[0] += '<th>' + COLS[f] + '</th>';
					html[1] += '<td>' + td + '</td>';
				}
			}
			html = '<table><tr>' + html[0] + '</tr><tr>' + html[1] + '</tr></table>';
			html += '<div class="center">' + TOKEN.getLink(tid, 'btn info save', 'Save') + '</div>';
			tt.innerHTML += html;
			return;
		}

		if (t.matches('.show.meaning')) {
			let tt = ttip(sel('.cfg', s), e, true);
			let html = ['', ''];
			for (const f in MEANING) {
				html[0] += '<th>' + MEANING[f] + '</th>';
				switch (f) {
					case 'primary':
					case 'other':
						html[1] += '<td><textarea name="' + f + '" class="input">' + encXml(format('', sel(f, xt)))
							+ '</textarea></td>';
						break;
					default:
						html[1] += '<td><input type="text" name="' + f + '" class="input" value="' + format('', sel(f, xt))
							+ '"></td>';
				}
			}
			html = '<table><tr>' + html[0] + '</tr><tr>' + html[1] + '</tr></table>';
			html += '<div class="center">' + TOKEN.getLink(tid, 'btn meaning save', 'Save') + '</div>';
			tt.innerHTML += html;
			// let tt = ttip(s, e);
			// let v = format(f, sel(f, xt));
			// tt.innerHTML += (format('', sel('primary', xt)) + '\n' + format('', sel('other', xt))).replace(v, '<strong>'
			// + v + '</strong>').replaceAll('\n', '<br>');
			return;
		}

		if (t.matches('.show.reason')) {
			let tt = ttip(sel('.cfg', s), e, true);
			let html = '';
			html += '<textarea name="reasoning" class="input">' + encXml(format('', sel('reasoning', xt))) + '</textarea>';
			html += '<div class="center">' + TOKEN.getLink(tid, 'btn reason save', 'Save') + '</div>';
			tt.innerHTML += html;
			// let tt = ttip(s, e);
			// tt.innerHTML += format('', sel('reasoning', xt)).replaceAll('\n', '<br>');
			return;
		}

		if (t.matches('.save.info,.save.meaning,.save.reason')) {
			let changed = false;
			each('[name],[data-name]', i => {
				let x = sel(i.dataset.name || i.name, xt);
				let v = (i.dataset.value || i.value).trim();
				if (i.type === 'checkbox' && !i.checked) v = 'False';
				if (v !== format('', x).trim()) {
					changed = true;
					x.setAttribute('modified', 'True');
					console.log(v);
					x.textContent = v;
				}
			}, t.closest('.tooltip'));
			if (changed) {
				if (t.matches('.info')) refresh([cid]);
				savePar([cid]);
			} else {
				trg(t.closest('.tooltip'), 'close');
			}
			return;
		}

		if (t.matches('.ins.token')) {
			let tt = ttip(sel('.cfg', s), e, true);
			let html = '';
			html += '<input type="text" class="input" value="">';
			html += '<div class="center">'
				+ TOKEN.getLink(tid, 'btn token ins-save left', 'Insert Before <b>%word%</b>')
					.replace('%word%', selToText(xt, 'form'))
				+ TOKEN.getLink(tid, 'btn token ins-save right', 'Insert After <b>%word%</b>')
					.replace('%word%', selToText(xt, 'form'))
				+ '</div>';
			tt.innerHTML += html;
			return;
		}

		if (t.matches('.ins-save.token')) {
			let input = sel('input', t.closest('.tooltip'));
			let val = input.value.trim();
			if (!val.length || val.indexOf(' ') !== -1) {
				addMsg(_('Invalid Format'), null, input);
				return;
			}
			let xt2 = parseXml(xt.outerHTML).documentElement;
			xt2.setAttribute('xml:id', getUID(x, xt.getAttribute('xml:id').split('_')[0]));
			let tkn = sel('word', xt2);
			tkn.textContent = val;
			tkn.setAttribute('modified', 'True');
			let tn = xt.previousSibling && xt.previousSibling.nodeName === '#text' ? xt.previousSibling.textContent : '';
			xs.insertBefore(xt2, t.classList.contains('left') ? xt : xt.nextSibling);
			if (tn.length) xs.insertBefore(x.createTextNode(tn), t.classList.contains('left') ? xt : xt.nextSibling);
			refresh([cid]);
			savePar([cid]);
			return;
		}

		if (t.matches('.del.token')) {
			delNode(xt);
			refresh([cid]);
			savePar([cid]);
			return;
		}

		if (t.matches('.set.content')) {
			let tt = ttip(sel('.cfg', s), e, true);
			let html = '';
			html += '<input type="url" name="api" class="input" placeholder="API URL" value="'
				+ (localStorage['metaphor_api'] || '') + '">';
			html += '<input type="password" name="token" class="input" placeholder="API Token" value="'
				+ (localStorage['metaphor_token'] || '') + '">';
			html += '<textarea name="content" class="input" placeholder="' + _('Content') + '"></textarea>';
			html += '<div class="center">'
				+ TOKEN.getLink(tid, 'btn save content', 'Save')
				+ '</div>';
			tt.innerHTML += html;
			return;
		}

		if (t.matches('.save.content')) {
			localStorage['metaphor_api'] = sel('[name="api"]', t.closest('.tooltip')).value;
			localStorage['metaphor_token'] = sel('[name="token"]', t.closest('.tooltip')).value;
			let txt = sel('[name="content"]', t.closest('.tooltip')).value.trim();
			if (!txt.length) {
				addMsg(_('Please provide content'), false, sel('[name="content"]', t.closest('.tooltip')));
				return;
			}
			if (!localStorage['metaphor_api']) {
				addMsg(_('Please provide API URL'), false, sel('[name="api"]', t.closest('.tooltip')));
				return;
			}
			// Show loading state
			let btn = t;
			let originalText = btn.textContent;
			btn.textContent = _('Processing...');
			btn.classList.add('disabled');
			fetch(localStorage['metaphor_api'], {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Authorization': 'Bearer ' + localStorage['metaphor_token']
				},
				body: JSON.stringify({text: txt})
			}).then(r => {
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
						} catch (e) {
							return Promise.reject(_('Invalid or wrong API URL'));
						}
					});
				}
				return r.text();
			}).then(function (data) {
				if (typeof data == 'string') {
					try {
						let xml = sel('body', parseXml(data));
						_content[cid] = xml.innerHTML;
						editor.forceReload = true;
						savePar([cid]);
					} catch (e) {
						addMsg(_('API response format is incorrect'), false, sel('[name="content"]', t.closest('.tooltip')));
					}
				} else {
					addMsg(_(data.detail || 'unknown error'), false, sel('[name="content"]', t.closest('.tooltip')));
				}
				// Restore button state
				btn.textContent = originalText;
				btn.classList.remove('disabled');
			}).catch(err => {
				addMsg(err || _('unknown error'), false, sel('[name="content"]', t.closest('.tooltip')));
				// Restore button state
				btn.textContent = originalText;
				btn.classList.remove('disabled');
			});
		}
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
