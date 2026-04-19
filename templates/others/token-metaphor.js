(function () {
	var INDIRECT = {
		'0': 'nincs',
		'1': 'metonímia',
		'2': 'generalizáció',
		'3': 'specifikáció'
	}

	var COLS = {
		'word': 'szó',
		'lemma': 'lemma',
		'pos': 'szófaj',
		'nerTag': 'névelem',
		'meanings': 'jelentés',
		'metaphor': 'metafora',
		'otherIndirect': 'indirekt',
		'comment': 'megjegyzés'
	}

	var MEANING = {
		'primary': 'elsődleges',
		'other': 'többi',
		'contextualIndex': 'jelenleg',
	}

	Locale['Meanings'] = 'Jelentések';
	Locale['Reasoning'] = 'Érvelés';
	Locale['Content'] = 'Tartalom (szöveges)';
	Locale['Set Paragraph...'] = 'Bekezdés felülírása';

	function format(name, el) {
		if (!el) return '&nbsp;';
		switch (name) {
			case 'metaphor':
				return _(TOKEN.SEL_BOOL[el.textContent] || '&nbsp;');
			case 'otherIndirect':
			let val = el.textContent.trim();
			if (val === 'None' || val === 'none') val = '0';
			return INDIRECT[val] || '&nbsp;';
			case 'meanings':
				let c = sel('contextualIndex', el);
				if (!c || 1 == c.textContent) return format('', sel('primary', el));
				return format('', sel('other', el)).replace(new RegExp('.*(?:^|\n)(' + c.textContent + '\\..*?)(?:\n.*|$)', 's'), '$1');
		}
		return el.textContent.replaceAll('\\n', '\n').replaceAll('\\t', '\t').trim().replaceAll(/[\t ]+/g, ' ').replaceAll(/ *\n */g, '\n');
	}

	var _active = {};
	var _content = {};

	Editor.TYPES.mm_p = {
		remove: function (input, chunk) {
			delete _active[input.dataset.cid];
		},
		getValue: function (input, chunk) {
			let x = _content[input.dataset.cid];
			if (x) { delete _content[input.dataset.cid]; return x; }
			x = _active[input.dataset.cid];
			return x ? x.documentElement.outerHTML : chunk.value;
		},
		render: function (chunk, cid) {
			let pr = 0;
			for (let cid2 in _active) pr = Math.max(pr, editor.chunks[cid2].id || 0);
			let h = '';
			for (let i in editor.hidden) {
				i = editor.hidden[i];
				if ((i.id || 0) > (editor.chunks[cid].id || 0)) break;
				if ((i.id || 0) < pr) continue;
				if (i.name == '.mm_head') h = i.value;
			}

			let x = parseXml(chunk.value);
			_active[parseInt(cid)] = x;
			let ep = parsePar(x);
			if (!ep.children.length) {
				ep.innerHTML = xmlToText(chunk.value) || '<em>' + _('EMPTY') + '</em>';
			} else {
				ep.classList.add('par', 'tei');
			}
			if (h) ep.innerHTML = '<h4>' + h + '</h4>' + ep.innerHTML;
			return ep;
		},
	}

	evt(editor.dom, 'change-hidden', function () {
		for (let i in editor.render_hidden) {
			let hid = editor.render_hidden[i];
			let h = editor.hidden[hid];
			if (h.name == '.mm_header') {
				let html = '';
				let x = parseXml(h.value);
				html = '<img class="logo" src="./templates/assets/metaphor-aid.webp" class="logo" style="height:3em"/>'
					+ '<h2>' + selToText(x, 'title') + '</h2>'
					+ '<h3>' + selToText(x, 'author') + '</h3>'
					+ html;
				sel('#header').innerHTML = html;
			}
		}
	});

	function parseXml(xml) {
		return (new DOMParser()).parseFromString(xml, 'text/xml');
	}

	function getUID(xml, prefix, start) {
		if (!sel('[*|id="' + prefix + (start ? '_' + start : '') + '"]', xml)) {
			return prefix + (start ? '_' + start : '');
		}
		return getUID(xml, prefix, start ? start + 1 : 2);
	}

	function delNode(s) {
		if (s.previousSibling && s.previousSibling.nodeName == '#text') s.previousSibling.remove();
		s.remove();
	}

	function parsePar(dom) {
		let tv = localStorage.tableview;
		let ep = document.createElement('div');
		if (tv) ep.className = 'table';
		each('s', function (s, si) {
			let es = document.createElement(tv ? 'table' : 'div');
			es.className = 's';
			es.dataset.sid = si;
			if (tv) {
				es.innerHTML = '<tbody><tr><th>' + Object.values(COLS).join('</th><th>') + '</th></tr></tbody>'
				es = es.children[0];
			}
			each('token', function (w, wi) {
				let ew = document.createElement(tv ? 'tr' : 'span');
				let j = w.getAttribute('join') || '';
				ew.className = 't';
				if (['left', 'both'].indexOf(j) != -1) ew.className += ' left';
				if (['right', 'both'].indexOf(j) != -1) ew.className += ' right';
				ew.dataset.tid = wi;
				let tkn = sel('word', w);
				if (!tkn) return;
				if (tv) {
					for (f in COLS) {
						let et = document.createElement('td');
						let el = sel(f, w);
						et.innerHTML = format(f, el).replaceAll('\n', '<br>');
						et.className = 'as-parent';
						ew.appendChild(et);
					}
				} else {
					ew.innerHTML = tkn.innerHTML || '&nbsp;';
				}
				es.appendChild(ew);
			}, s);
			let ew = document.createElement(tv ? 'tr' : 'span');
			ew.className = 'cfg';
			ew.innerHTML = tv ? '<td colspan="42" class="as-parent">⚙</td>' : '⚙';
			es.appendChild(ew);
			ep.appendChild(tv ? es.parentNode : es);
		}, dom);
		return ep;
	}

	function savePar(cids) {
		let hdata = {};
		editor.onchange(cids, hdata);
	}

	function refresh(cids) {
		//TODO: update from API
	}

	document.addEventListener('click', function (e) {
		let t = e.target;
		if (!t) return;

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
			each('.par .active', function (i) { i.classList.remove('active'); });
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
						split[i] = encXml(tkn.substr(0, i)) + ' | ' + encXml(tkn.substr(i));
					}
					html += TOKEN.getSelect(tid, 'split token', '', 'Split Token...', split);
				}
				html += TOKEN.getSelect(tid, 'join token', '', 'Join Token...', TOKEN.SEL_WHERE);
				html += TOKEN.getLink(tid, 'ins token', 'Insert Token');
				html += TOKEN.getLink(tid, 'del token', 'Delete Token');
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
			for (f in COLS) {
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
						// html += (format('', sel('primary', xt)) + '\n' + format('', sel('other', xt))).replace(v, '<strong>' + v + '</strong>').replaceAll('\n', '<br>');
						break;
					case 'comment':
						td = '<textarea name="' + f + '" class="input">' + encXml(format('', sel(f, xt))) + '</textarea>';
						break;
					case 'metaphor':
						td = '<input type="checkbox" name="' + f + '" class="input" value="True"' + ('True' == format('', sel(f, xt)) ? ' checked' : '') + '>';
						break;
					case 'otherIndirect':
						let el = sel(f, xt);
						let rawValue = el ? el.textContent.trim() : '';
						let value = rawValue;
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
			let html = '';
			html = ['', ''];
			for (f in MEANING) {
				html[0] += '<th>' + MEANING[f] + '</th>';
				switch (f) {
					case 'primary':
					case 'other':
						html[1] += '<td><textarea name="' + f + '" class="input">' + encXml(format('', sel(f, xt))) + '</textarea></td>';
						break;
					default:
						html[1] += '<td><input type="text" name="' + f + '" class="input" value="' + format('', sel(f, xt)) + '"></td>';
				}
			}
			html = '<table><tr>' + html[0] + '</tr><tr>' + html[1] + '</tr></table>';
			html += '<div class="center">' + TOKEN.getLink(tid, 'btn meaning save', 'Save') + '</div>';
			tt.innerHTML += html;
			// let tt = ttip(s, e);
			// let v = format(f, sel(f, xt));
			// tt.innerHTML += (format('', sel('primary', xt)) + '\n' + format('', sel('other', xt))).replace(v, '<strong>' + v + '</strong>').replaceAll('\n', '<br>');
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
			let changed  = false;
			each('[name],[data-name]', function(i) {
				let x = sel(i.dataset.name || i.name , xt);
				let v = (i.dataset.value || i.value).trim();
				if (i.type == 'checkbox' && !i.checked) v = 'False';
				if (v != format('', x).trim()) {
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
				+ TOKEN.getLink(tid, 'btn token ins-save left', 'Insert Before <b>%word%</b>').replace('%word%', selToText(xt, 'form'))
				+ TOKEN.getLink(tid, 'btn token ins-save right', 'Insert After <b>%word%</b>').replace('%word%', selToText(xt, 'form'))
				+ '</div>';
			tt.innerHTML += html;
			return;
		}

		if (t.matches('.ins-save.token')) {
			let input = sel('input', t.closest('.tooltip'));
			let val = input.value.trim();
			if (!val.length || val.indexOf(' ') != -1) {
				addMsg(_('Invalid Format'), null, input);
				return;
			}
			let xt2 = parseXml(xt.outerHTML).documentElement;
			xt2.setAttribute('xml:id', getUID(x, xt.getAttribute('xml:id').split('_')[0]));
			let tkn = sel('word', xt2);
			tkn.textContent = val;
			tkn.setAttribute('modified', 'True');
			let tn = xt.previousSibling && xt.previousSibling.nodeName == '#text' ? xt.previousSibling.textContent : '';
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
			html += '<input type="url" name="api" class="input" placeholder="API URL" value="' + (localStorage['metaphor_api'] || '') + '">';
			html += '<input type="password" name="token" class="input" placeholder="API Token" value="' + (localStorage['metaphor_token'] || '') + '">';
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
			if (txt.length && localStorage['metaphor_api']) {
				fetch(localStorage['metaphor_api'], {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Authorization': 'Bearer ' + localStorage['metaphor_token']
					},
					body: JSON.stringify({text:txt})
				}).then(r => r.ok ? r.text() : r.json()).then(function(data) { 
					if (typeof data == 'string') {
						let xml = sel('body', parseXml(data));
						_content[cid] = xml.innerHTML;
						editor.forceReload = true;
						savePar([cid]);
					} else {
						addMsg(data.detail || 'unknown error', false, sel('[name="content"]', t.closest('.tooltip')));
					}
				});
			}
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
			if (val == '') return;
			let tkn = sel('word', xt);
			tkn.setAttribute('modified', 'True');
			let xt2 = parseXml(xt.outerHTML).documentElement;
			sel('word', xt2).textContent = tkn.textContent.substr(val);
			let id1 = xt.getAttribute('xml:id');
			if (id1) xt2.setAttribute('xml:id', getUID(x, id1.split('_')[0]));
			tkn.textContent = tkn.textContent.substr(0, val);
			xs.insertBefore(xt2, xt.nextSibling);
			if (xt.previousSibling && xt.previousSibling.nodeName == '#text') {
				xs.insertBefore(x.createTextNode(xt.previousSibling.textContent), xt.nextSibling);
			}
			refresh([cid]);
			savePar([cid]);
			return;
		}

		if (t.matches('.join.token')) {
			if (val == '') return;
			let off = val == '0' ? -1 : 1;
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
			if (val == '') return;
			let xt2 = xtl[parseInt(tid) + (val == '0' ? 0 : 1)];
			if (!xt2 || xt2 == xtl[0]) {
				addMsg(_('Invalid Action'));
				return;
			}
			let indent = xs.previousSibling && xs.previousSibling.nodeName == '#text' ? xs.previousSibling.textContent : '';
			xs.setAttribute('modified', 'True');
			xs.insertBefore(x.createElement('split'), xt2);
			let xe = x.documentElement;
			let id = xs.getAttribute('xml:id').split('_')[0];
			xe.innerHTML = xe.innerHTML.replace(/([ \t\r\n]*)<split[^>]*>/
				, indent + '</' + xs.nodeName + '>' + indent + '<' + xs.nodeName + (id ? ' xml:id="' + getUID(x, id) + '"' : '') + ' modified="True"> $1');
			refresh([cid]);
			savePar([cid]);
			return;
		}

		if (t.matches('.join.sent')) {
			if (val == '') return;
			let off = val == '0' ? -1 : 1;
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
			if (val == '') return;
			let off = val == '0' ? -1 : 1;
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
				let indent = xs.previousSibling && xs.previousSibling.nodeName == '#text' ? xs.previousSibling.textContent : '';
				x2.innerHTML = x2.innerHTML.replace(/([ \t\r\n]*)$/, indent + xs.outerHTML + '$1');
			}
			delNode(xs);
			savePar(off > 0 ? [cid, cid + off] : [cid + off, cid]);
			return;
		}
	});

})();



