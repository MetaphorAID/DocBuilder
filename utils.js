/**
 * @param {string} selector
 * @param {ParentNode} [dom=document]
 * @param {*} [def=null]
 */
function sel(selector, dom = document, def = null) {
	return dom.querySelector(selector) || def;
}

function find(selector, dom = document) {
	return dom.querySelectorAll(selector);
}

function each(target, fn, dom) {
	const arr = typeof target === 'string' ? find(target, dom) :
		(target instanceof HTMLElement ? [target] : target);
	for (let i = 0; i < arr.length; ++i) if (fn(arr[i], i) === false) break;
}

function evt(target, types, fn, dom) {
	each(target, el => {
		types.split(' ').forEach(type => {
			el.addEventListener(type, function (e) {
				try {
					return fn.call(this, e);
				} catch (err) {
					if (e.appErrors) {
						e.appErrors.push(err);
						e.stopImmediatePropagation();
						return;
					}
					throw err;
				}
			});
		});
	}, dom);
}

function evtDelegated(parent, selector, type, fn) {
	parent.addEventListener(type, e => {
		const target = e.target.closest(selector);

		if (target) fn.call(target, e);
	});
}

function trg(target, eventName, dom) {
	each(target, el => el.dispatchEvent(new Event(eventName, {bubbles: true})), dom);
}

function dispatchAppEvent(target, event, dom) {
	event.appErrors = [];
	each(target, el => {
		el.dispatchEvent(event);
		return !event.appErrors.length;
	}, dom);
	if (event.appErrors.length) throw event.appErrors[0];
}

function parseXml(xml) {
	return (new DOMParser()).parseFromString(xml, 'text/xml');
}

function encXml(t) {
	return String(t)
		.replaceAll('&', '&amp;')
		.replaceAll("'", '&apos;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function decXml(t) {
	return String(t)
		.replaceAll('&apos;', "'")
		.replaceAll('&quot;', '"')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&amp;', '&');
}

function xmlToText(xml, decode) {
	const t = (xml || '')
		.replace(/<[^>]+>/gs, ' ')
		.trim();
	return (decode ? decXml(t) : t.replace("'", '&apos;').replace('"', '&quot;'))
		.replaceAll('\\n', '\n')
		.replaceAll('\\t', '\t')
}

function selToText(dom, s, decode) {
	return xmlToText(sel(s, dom, {}).innerHTML, decode);
}

function addMsg(message, cls, target) {
	const m = document.createElement('div');
	m.className = `${cls || 'error'} msg`;
	m.innerHTML = message;
	if (target?.classList.contains('input')) {
		target.parentNode.insertBefore(m, target.nextSibling);
	} else {
		(target || sel('#message')).appendChild(m);
	}
	setTimeout(() => m.remove(), 5000);
}

function addConfirm(message, onconfirm) {
	const m = document.createElement('div');
	m.className = 'confirm';
	m.innerHTML = message +
		`<a href="#" class="btn error yes">${_('Yes')}</a> ` +
		`<a href="#" class="btn cancel">${_('Cancel')}</a>`;
	evtDelegated(m, '.yes,.cancel', 'click', e => {
		e.preventDefault();
		e.target.closest('.confirm').remove();
		// If Yes was clicked, execute callback
		if (e.target.matches('.yes')) onconfirm();
	});
	sel('body').appendChild(m);
}

function ttip(dom, event = null, modal = false) {
	const tooltip = document.createElement('div');
	tooltip.className = `tooltip${modal ? ' modal' : ''}`;

	// Insert after trigger element
	dom.insertAdjacentElement('afterend', tooltip);

	// Close other non-modal tooltips
	clean_ttip(tooltip);

	const container = tooltip.offsetParent || document.body;

	// Calculate position relative to container
	const trigger = event ? event.target : dom;

	const triggerRect = trigger.getBoundingClientRect();
	const containerRect = container.getBoundingClientRect();

	const x = triggerRect.left - containerRect.left;
	const y = triggerRect.top - containerRect.top;

	// Determine whether tooltip should appear above or below
	const showAbove = event ? event.clientY > window.innerHeight / 2 : y > container.clientHeight / 2;

	if (showAbove) {
		tooltip.style.bottom = `${container.clientHeight - y + 5}px`;
	} else {
		tooltip.style.top = `${y + (event ? 10 : dom.offsetHeight)}px`;
	}

	// Horizontal positioning
	if (!modal) {
		const showLeft = x < container.clientWidth / 2;

		if (showLeft) {
			tooltip.style.left = `${x}px`;
		} else {
			tooltip.style.right = `${container.clientWidth - x - (event ? 0 : dom.offsetWidth)}px`;
		}
	} else {
		tooltip.innerHTML = '<a href="#" class="btn close">✕</a>';
	}

	return tooltip;
}

function clean_ttip(currentTooltip) {
	find('.tooltip:not(.modal)').forEach(tooltip => {
		// Skip the tooltip being created
		if (tooltip === currentTooltip) return;

		// Skip ancestors containing it
		if (tooltip.contains(currentTooltip)) return;

		trg(tooltip, 'close');
	});
}

function select(value, emptyOption, options, multiple = false) {
	// Create select container
	const select = document.createElement('div');
	select.className = `select${multiple ? ' multiple' : ''}`;
	select.dataset.value = multiple ? JSON.stringify(value) : value;

	// Create options in container and set selected ones
	const selectedValues = Array.isArray(value) ? value : [value];
	for (const [key, label] of Object.entries(options)) {
		const option = document.createElement('a');
		option.href = '#';
		option.dataset.value = key;
		option.textContent = _(label);

		if (selectedValues.includes(key)) option.classList.add('selected');

		select.appendChild(option);
	}

	// Create empty option if allowed and select it if nothing is selected
	if (emptyOption !== undefined) {
		const option = document.createElement('a');
		option.href = '#';
		option.className = 'no-value';
		option.textContent = _(emptyOption);

		if (!select.querySelector('.selected')) option.classList.add('selected');

		select.prepend(option);
	}

	return select;
}

function disable(s, enable, dom) {
	const el = sel(s, dom);
	if (el) el.classList.toggle('disabled', !enable);
}

class FileSelectionCancelledError extends Error {}

function pickFile({extension, multiple = false, accept} = {}) {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept ?? (extension ? `.${extension}` : '');
		input.multiple = multiple;
		input.style.display = 'none';

		document.body.appendChild(input);

		let done = false;

		// Reliable cleanup without DOM leaking
		const cleanup = () => {
			if (done) return;
			done = true;
			input.remove();
		};

		const fail = () => {
			cleanup();
			reject(new FileSelectionCancelledError('No file chosen'));
		};

		input.addEventListener('change', () => {
			const files = Array.from(input.files || []);
			cleanup();

			if (!files.length) return fail();
			resolve(multiple ? files : files[0]);
		});

		window.addEventListener('focus', () => {
			// When regaining the focus (FilePicker dialog closed) allot 100ms to process change, if still no file, then fail
			setTimeout(() => {
				if (!done && (!input.files || input.files.length === 0)) fail();
			}, 100);
		}, {once: true});

		input.click();
	});
}

function readFile(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = e => resolve(e.target.result);
		reader.onerror = reject;

		reader.readAsText(file, 'UTF-8');
	});
}

function downloadAsFile(fileName, blob) {
	// Create a temporary object URL to download
	const url = URL.createObjectURL(blob);

	// Create a temporary <a> element to trigger the download
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;  // Original file name
	a.click();              // Simulate click to download

	// Clean up the temporary URL
	URL.revokeObjectURL(url);
	// Clean up the temporary <a> element
	a.remove();
}
