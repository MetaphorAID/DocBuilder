(function () {

	var _active = {};
	var _cols = {};

	Editor.TYPES.s = {
		remove: function (input, chunk) {
			delete _active[input.dataset.cid];
		},
		getValue: function (input, chunk) {
			var x = input ? _active[input.dataset.cid] : false;
			return x ? stringifyTsv(x) : chunk.value;
		},
		render: function (chunk, cid) {
			if (!_cols.length && editor.hidden[0]) {
				var c = editor.hidden[0].value.split('\t');
				for (var c1 in c) _cols[c[c1]] = c1;
				if (typeof (_cols.lemma) == 'undefined') { _cols.lemma = c.length; c.push('lemma'); }
				if (typeof (_cols.xpostag) == 'undefined') { _cols.xpostag = c.length; c.push('xpostag'); }
				if (typeof (_cols.verified) == 'undefined') { _cols.verified = c.length; c.push('verified'); }
				_cols._length = c.length;
				_cols._header = c.join('\t');
			}
			var pr = 0;
			for (var cid2 in _active) pr = Math.max(pr, editor.chunks[cid2].id || 0);
			var x = parseTsv(chunk.value);
			_active[parseInt(cid)] = x;
			var ep = parseSent(x);
			if (!ep.children.length) {
				ep.innerHTML = chunk.value || '<em>' + _('EMPTY') + '</em>';
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
		try {
			return JSON.parse(token[_cols['anas']] || 'null') || [];
		} catch (e) {
			console.error(e);
		}
		return [];
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
		text = [];
		for (var t in tokens) {
			text.push(tokens[t].join('\t'));
		}
		return text.join(editor.eol);
	}

	function parseTsv(text) {
		text = text.split(editor.eol);
		var x = [];
		for (var t in text) {
			t = text[t].split('\t');
			//if (t[0] != '') while (t.length < _cols._length) t.push('');
			x.push(t);
		}
		return x;
	}

	function selectedAna(anas, token) {
		var lemma = getLemma(token);
		if (!lemma) return anas[0] || false;
		for (var a1 in anas) {
			a1 = anas[a1];
			if (lemma == a1.lemma && getPosTag(token) == a1.tag) return a1;
		}
		return { lemma: lemma, tag: getPosTag(token), custom: true };
	}

	function parseSent(tokens) {
		var tv = localStorage.tableview;
		var ep = document.createElement('div');
		if (tv) ep.className = 'table';
		var es = document.createElement(tv ? 'table' : 'div');
		es.className = 's';
		if (tv) {
			es.innerHTML = '<tbody><tr><th>' + _('Token') + '</th><th>' + _('Lemma') + '</th><th>' + _('Detailed') + '</th><th>' + _('Simple') + '</th><th></th></tr></tbody>';
			es = es.children[0];
		}
		each(tokens, function (w, wi) {
			var ew = document.createElement(tv ? 'tr' : 'span');
			var j = ''; // sticky token ?
			ew.className = 't';
			if (['left', 'both'].indexOf(j) != -1) ew.className += ' left';
			if (['right', 'both'].indexOf(j) != -1) ew.className += ' right';
			ew.dataset.tid = wi;
			if (!w[0] && w.length < 2) return;
			var anas = getAnas(w);
			if (!getVerified(w)) {
				ew.className += ' unchecked';
				if (anas.length == 1) ew.className += ' single';
			}
			if (tv) {
				var et = document.createElement('td');
				et.innerHTML = getToken(w) || '&nbsp;';
				et.className = 'as-parent';
				ew.appendChild(et);
				var ana = selectedAna(anas, w);
				et = document.createElement('td');
				et.className = 'as-parent';
				et.innerHTML = ana && ana.lemma || '&nbsp;';
				ew.appendChild(et);
				et = document.createElement('td');
				et.className = 'as-parent';
				et.innerHTML = ana && ana.readable || '&nbsp;';
				ew.appendChild(et);
				et = document.createElement('td');
				et.className = 'as-parent';
				et.innerHTML = ana && ana.tag || '&nbsp;';
				ew.appendChild(et);
				et = document.createElement('td');
				if (ana) {
					et.className = 'selAna';
					et.dataset.tid = wi;
					et.dataset.ana = 'default';
					et.innerHTML = '✓';
				} else {
					et.className = 'as-parent';
					et.innerHTML = '&nbsp;';
				}
				ew.appendChild(et);
			} else {
				ew.innerHTML = getToken(w) || '&nbsp;';
			}
			es.appendChild(ew);
		});
		var ew = document.createElement(tv ? 'tr' : 'span');
		ew.className = 'cfg';
		ew.innerHTML = tv ? '<td colspan="5" class="as-parent">⚙</td>' : '⚙';
		es.appendChild(ew);
		ep.appendChild(tv ? es.parentNode : es);
		return ep;
	}

	function saveSent(cids) {
		var hdata = {};
		if (editor.hidden[0] && (editor.hidden[0].value != _cols._header)) {
			hdata[0] = _cols._header;
		}
		editor.onchange(cids, hdata);
	}

	// function updJoin(tid, xtl) {
	// 	var l = tid > 0 && ['right', 'both'].indexOf(xtl[tid - 1].getAttribute('join')) != -1;
	// 	var r = tid < xtl.length - 1 && ['left', 'both'].indexOf(xtl[tid + 1].getAttribute('join')) != -1;
	// 	xtl[tid].setAttribute('join', l ? (r ? 'both' : 'left') : (r ? 'right' : 'no'));
	// }

	function updAna(tokens, cid) {
		var token = tokens.shift();
		var formData = new FormData();
		formData.append('file', new Blob(['form\n' + getToken(token) + '\n'], { type: 'text/plain' }), 'input.txt');
		fetch('/proxy?u=' + encodeURIComponent('https://juniper.nytud.hu/emtsv/morph'), {
			method: 'POST',
			body: formData
		}).then(r => r.text()).then(function (data) {
			token[_cols['anas']] = data.replace(/^[^\r\n]*[\r\n]+[^\t]*\t/, '').trim();
			setAna(token, '', '');
			if (tokens.length) {
				updAna(tokens, cid);
			} else {
				saveSent([cid]);
			}
		});
	}


	document.addEventListener('click', function (e) {
		var t = e.target;
		if (!t) return;

		var c = t.closest('.par.xtsv');
		if (!c) return;

		if (localStorage.tableview && t.classList.contains('as-parent')) t = t.parentNode;

		var cid = parseInt(c.dataset.cid);
		var s = t.closest('.s');
		var x = _active[cid];
		var tid = t.dataset.tid;
		var xt = tid ? x[tid] : false;

		// open tooltip
		if (t.matches('.t, .cfg')) {
			each('.par .active', function (i) { i.classList.remove('active'); });
			var html = '';
			if (xt) { //token
				t.classList.add('active');
				html += TOKEN.getLink(tid, 'edit ana', 'Select Ana.');
				//html += TOKEN.getSelect(tid, 'edit sticky', xt.getAttribute('join') || '?', 'Sticks To...', TOKEN_STICKY);
				var w = getToken(xt);
				if (w.length > 1) {
					var split = {};
					for (var i = 1; i < w.length; ++i) {
						split[i] = encXml(w.substr(0, i)) + ' | ' + encXml(w.substr(i));
					}
					html += TOKEN.getSelect(tid, 'split token', '', 'Split Token...', split);
				}
				html += TOKEN.getSelect(tid, 'join token', '', 'Join Token...', { '0': 'Before', '1': 'After' });
				html += TOKEN.getLink(tid, 'edit token', 'Fix Token');
				html += TOKEN.getLink(tid, 'ins token', 'Insert Token');
				html += TOKEN.getLink(tid, 'del token', 'Delete Token');
			} else {
				s.classList.add('active');
			}
			if (xt) {
				html += TOKEN.getSelect(tid, 'split sent', '', 'Split Sentence...', { '0': 'Before', '1': 'After' });
			} else {
				html += TOKEN.getSelect(tid, 'join sent', '', 'Join Sentence...', { '0': 'Before', '1': 'After' });
			}

			var tt = ttip(t, e);
			tt.classList.add('dropdown');
			tt.innerHTML = html;
			return;
		}

		if (t.matches('.edit.ana')) {
			var html = '';
			html += '<h3 class="tkn">' + _('Token') + ': <strong>' + getToken(xt) + '</strong></h3>';
			html += '<table><tr><th>' + _('Lemma') + '</th><th>' + _('Detailed') + '</th><th>' + _('Simple') + '</th><th></th></tr>';
			var anas = getAnas(xt);
			var ana = selectedAna(anas, xt) || {};
			each(anas, function (i, ii) {
				html += '<tr><td>' + i.lemma + '</td><td>' + i.readable + '</td><td>' + i.tag + '</td>'
					+ '<td><a href="#" data-tid="' + tid + '" data-ana="' + ii + '" class="btn selAna ' + (ana == i ? 'selected' : '') + '">✓</a></td>'
					+ '</tr>'
			});
			html += '<tr>'
				+ '<td><input class="input" type="text" value="' + (ana.custom ? ana.lemma : '') + '"></td>'
				+ '<td>&nbsp;</td>'
				+ '<td><input class="input" type="text" value="' + (ana.custom ? ana.tag : '') + '"></td>'
				+ '<td><a href="#" data-tid="' + tid + '" class="btn selAna ' + (ana.custom ? 'selected' : '') + '">✓</a></td>'
			html += '</table>';
			html += '<div class="center">' + TOKEN.getLink(tid, 'btn ana fetch', 'Re-Analyze') + TOKEN.getLink(tid, 'btn ana save', 'Save') + '</div>';
			var tt = ttip(sel('.cfg', s), e, true);
			tt.innerHTML += html;
			evt('table input', 'focus', function () { trg('.btn', 'click', this.closest('tr')); }, tt)
			return;
		}
		if (t.matches('.selAna')) {
			var anas = getAnas(xt);
			if (t.dataset.ana === 'default') {
				var ana = selectedAna(anas, xt);
				setAna(xt, ana.lemma, ana.tag);
				saveSent([cid]);
			} else {
				each('.btn.selAna', function (i) { i.classList.remove('selected') }, t.closest('table'));
				t.classList.add('selected');
			}
			return;
		}
		if (t.matches('.save.ana')) {
			var input = sel('.selAna.selected', t.closest('.tooltip'));
			if (!input) {
				addMsg(_('No Selected Analyzation'), null, t.closest('.tooltip'));
				return;
			}
			if (input.dataset.ana) {
				var anas = getAnas(xt);
				var ana = anas[input.dataset.ana];
				setAna(xt, ana ? ana.lemma : '', ana ? ana.tag : '');
			} else {
				input = find('input', input.closest('tr'));
				var vals = [
					input[0].value.trim(),
					input[1].value.trim(),
				];
				if (!vals[0].length || vals[0].indexOf(' ') != -1) {
					addMsg(_('Invalid Format'), null, input[0]);
					return;
				}
				setAna(xt, vals[0], vals[1]);
			}
			saveSent([cid]);
			return;
		}
		if (t.matches('.fetch.ana')) {
			updAna([xt], cid);
			return;
		}

		if (t.matches('.edit.token')) {
			var html = '';
			html += '<input type="text" class="input" value="' + getToken(xt) + '">';
			html += '<div class="center">' + TOKEN.getLink(tid, 'btn token save', 'Save') + '</div>';
			var tt = ttip(sel('.cfg', s), e, true);
			tt.innerHTML += html;
			return;
		}
		if (t.matches('.save.token')) {
			var input = sel('input', t.closest('.tooltip'));
			var val = input.value.trim();
			if (getToken(xt) == val) {
				trg(t.closest('.tooltip'), 'close');
				return;
			}
			if (!val.length || val.indexOf(' ') != -1) {
				addMsg(_('Invalid Format'), null, input);
				return;
			}
			resetToken(xt, val);
			updAna([xt], cid);
			return;
		}

		if (t.matches('.ins.token')) {
			var html = '';
			html += '<input type="text" class="input" value="">';
			html += '<div class="center">'
				+ TOKEN.getLink(tid, 'btn token ins2 left', 'Insert Before <b>%word%</b>').replace('%word%', getToken(xt))
				+ TOKEN.getLink(tid, 'btn token ins2 right', 'Insert After <b>%word%</b>').replace('%word%', getToken(xt))
				+ '</div>';
			var tt = ttip(sel('.cfg', s), e, true);
			tt.innerHTML += html;
			return;
		}
		if (t.matches('.ins2.token')) {
			var input = sel('input', t.closest('.tooltip'));
			var val = input.value.trim();
			if (!val.length || val.indexOf(' ') != -1) {
				addMsg(_('Invalid Format'), null, input);
				return;
			}
			var tid2 = t.classList.contains('left') ? tid : parseInt(tid) + 1;
			var xt2 = [];
			resetToken(xt2, val);
			x.splice(tid2, 0, xt2);
			updAna([x[tid2]], cid);
			return;
		}

		if (t.matches('.del.token')) {
			delete x[tid];
			saveSent([cid]);
			return;
		}

	});

	document.addEventListener('change', function (e) {
		var t = e.target;
		if (!t) return;

		var c = t.closest('.par.xtsv');
		if (!c) return;

		var cid = parseInt(c.dataset.cid);
		var s = t.closest('.s');
		var x = _active[cid];
		var tid = t.dataset.tid;
		var xt = tid ? x[tid] : false;

		// sentence stuff

		var val = t.dataset.value || t.value;
		if (t.classList.contains('multiple')) val = JSON.parse(t.dataset.value);

		if (t.matches('.join.sent')) {
			if (val == '') return;
			var cid2 = cid + (val == '0' ? -1 : 1);
			if (cid2 < 0) return;
			if (!_active[cid2]) {
				var e = editor.renderChunk(cid2);
				if (e) c.parentNode.insertBefore(e, cid2 > cid ? c.nextSibling : c);
			}
			if (!_active[cid2]) {
				addMsg(_('Invalid Action'));
				return;
			}
			cid2 = Math.max(cid, cid2);
			if (_active[cid2][0].length < 2) {
				_active[cid2].shift();
				editor.forceReload = true;
				saveSent([cid2]);
			}
			return;
		}

		if (t.matches('.split.sent')) {
			if (val == '') return;
			x.splice(parseInt(tid) + (val == '0' ? 0 : 1), 0, ['']);
			editor.forceReload = true;
			saveSent([cid], true);
			return;
		}

		// token stuff

		// if (t.matches('.edit.sticky')) {
		// 	tid = parseInt(tid);
		// 	xt.setAttribute('join', val);
		// 	if (tid > 0) updJoin(tid - 1, xtl);
		// 	if (tid < xtl.length - 1) updJoin(tid + 1, xtl);
		// 	savePar([cid]);
		// 	return;
		// }

		if (t.matches('.join.token')) {
			if (val == '') return;
			var off = val == '0' ? -1 : 1;
			var xt2 = x[parseInt(tid) + off];
			if (!xt2) {
				addMsg(_('Invalid Action'));
				return;
			}
			resetToken(xt, off > 0 ? (getToken(xt) + getToken(xt2)) : (getToken(xt2) + getToken(xt)));
			delete x[parseInt(tid) + off];
			updAna([xt], cid);
			return;
		}

		if (t.matches('.split.token')) {
			if (val == '') return;
			var xt2 = [];
			resetToken(xt2, getToken(xt).substr(0, val));
			resetToken(xt, getToken(xt).substr(val));
			x.splice(tid, 0, xt2);
			updAna([xt, x[parseInt(tid) + 1]], cid);
			return;
		}

	});

})();