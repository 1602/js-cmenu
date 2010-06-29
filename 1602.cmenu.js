/**
 * Author: A.Chakkaev [1602] http://1602.habrahabr.ru/
 * Created: summer 2008
**/
/*global cm_img, globals, MenuItem, jQuery*/

(function ($) {

	var window = this,
	undefined,
	cls_item_with_submenu = 'cmenuItemWithSub',
	cls_item = 'cmenuItem';

	if (!$.isFunction(window.cm_img)) {
		window.cm_img = function (img, alt, style, nodefsize) {/* {{{ */
			if (alt) {
				alt = alt.replace(/"/, '\"');
			}
			return '<img src="/images/icons/' + img + 
				(img.search(/\.(gif|jpg|jpeg)$/i) === -1?'.png':'') +
				'" ' + (nodefsize ? '' : 'width="16" height="16"')
				+ ' alt="' +
				(alt?alt:'img') + '" ' +
				(alt?'title="' + alt + '"':'') +
				(style?' style="' + style + '"':'') + ' />';
		/* }}} */
		};
	}

	if (window.globals === undefined) {
		window.globals = {
			activeModule: window
		};
	}

	/**
	 * create object MenuItem
	 *
	 * @param string caption	displayed label, required parameter, if first symbol is "!"
	 *							then this menu item is disabled by default
	 * @param string icon		name of 16x16 icon, displayed on the left side of label, optional
	 * @param function execute	this will called when menu item was triggered
	 * @param object submenu	subitems of current item
	**/
	window.MenuItem = function (caption, icon, execute, submenu) {
		if (caption.search(/^!/) !== -1) {
			this.disabled = true;
			caption = caption.substr(1);
		}
		this.caption = caption;
		this.icon = icon;
		this.execute = execute;
		this.submenu = submenu;
	};

	function create_cmenu_object(actions) {
		var new_cmenu_id = $.cmenu.c.length,
		cmenu_object = {
			cn: 'cmenu',
			id: new_cmenu_id,
			jq: $('<div iuid="' + new_cmenu_id + '" class="cmenu"></div>'),
			r: false
		};
		cmenu_object[$.isFunction(actions)?'f':'a'] = actions;

		$('body').append(cmenu_object.jq);

		$.cmenu.c[new_cmenu_id] = cmenu_object;
		return cmenu_object;
	}

	function get_path(el) {		/* Menu calling stack	{{{ */
		var p = [], jel;
		while (el) {
			jel = $(el);
			if (!jel.hasClass(cls_item)) {
				p.push(el);
				break;
			}
			el.cmenu = $.cmenu.get_menu(parseInt(jel.parent().attr('iuid'), 10));
			el.cmenu_item = el.cmenu.a[jel.attr('item_id')];
			p.push(el);

			// Go to parent
			el = el.cmenu.caller;
		}
		return p.reverse();
		/* }}} */
	}

	function get_offset(el, stop) {/* Offset el against stop	{{{ */
		//console.log(el.tagName,el.offsetLeft,el.offsetTop);
		if (el.offsetParent && el.offsetParent !== stop) {
			var of = get_offset(el.offsetParent, stop);
			of.x += el.offsetLeft;
			of.y += el.offsetTop;
			return of;
		} else {
			return {
				x: el.offsetLeft,
				y: el.offsetTop
			};
		}
		/* }}} */
	}

	function hide_all() {			/* Hide all displayed menus	{{{ */
		// Если блокировано сокрытие меню - выйти
		if ($.cmenu.lockHiding) {
			return false;
		}
		// Отбиндить сокрытие всех меню по клику
		$().unbind('click', hide_all);
		$.cmenu.hideBinded = false;
		// Скрыть менюшки
		var len = $.cmenu.c.length;
		for (var i = 0; i < len; i++) {
			$.cmenu.hide_menu($.cmenu.c[i]);
		}
		/* }}} */
	}

	function get_caller(id, event) {/* Compile menu-caller-string (inline script attributes)	{{{ */
		var m = false;
		if (typeof id === 'object') {
			m = true;
			id = id.id;
		}
		if (typeof id !== 'number') {
			//console.error('get_caller - unexpected type of first parameter ('+(typeof id)+'), expecting number');
			return '';
		}
		switch (event) {
		case 'click':
		default:
			return 'onclick="$.cmenu.show(' + id + ',this);$.cmenu.lockHiding=true;" onmouseout="$.cmenu.lockHiding=false;"';
		case 'hovertimeout':
			return 'onmouseover="var t=this;$.cmenu.to=setTimeout(function(){$.cmenu.show(' + id + ',t);$.cmenu.lockHiding=true;},200);" onmouseout="clearTimeout($.cmenu.to);$.cmenu.lockHiding=false;"';
				// (m?'m=$.cmenu.get_menu('+id+');m&&m.sub&&$.cmenu.hide_menu(m.sub);':'')
		}

		/* }}} */
	}

	function handle_userfunc(menu) {
		if (!$.isFunction(menu.f)) {
			return true;
		}

		if (typeof menu.caller !== 'object') {
			return false;
		}

		// result of user function should be object or boolean
		var userfunc_result = menu.f(menu);
		if (typeof userfunc_result === 'object') {
			menu.a = userfunc_result;
			menu.r = false;
		} else {
			menu.r = !userfunc_result;
		}

		return true;
	}

	function handle_async(menu) {
		if (!menu.async) {
			return true;
		}
		if (!menu.a) {
			menu.done = function () {
				menu.v = false;
				$.cmenu.show(menu, menu.caller);
			};
			return false;
		}
		menu.r = false;
		return true;
	}

	function handle_rendered(menu) {
		if (menu.r) {
			return false;
		}
		menu.r = true;
		return true;
	}

	function is_invisible(item) {
		return item.visible !== undefined && !item.visible ||
			item.acid !== undefined && $.inArray(item.acid, globals.accessedActions || []);
	}

	function render_item(menu, i, radio) { /* {{{ */
		var a = menu.a[i];
		if (a === '-') {                        
			return '<hr' + ($.browser.msie?' style="width:50px;align:center;"':'') + '/>';
			//return h += '<div class="hr"></div>';
		}

		if (a.constructor === Array) {
			a = new MenuItem(a[0], a[1], a[2], a[3]);
			menu.a[i] = a;
		}

		menu.a[i].parent = menu.parent_item;

		if (is_invisible(a)) {
			return '';
		}

		if (a.submenu && (!a.submenu.cn || a.submenu.cn !== 'cmenu')) {
			a.submenu = $.cmenu.get_menu(a.submenu);
		}

		var caption = a.caption;
		if (radio && caption === radio) { // radio
			caption = '<strong><u>' + a.caption + '</u></strong>';
		} else { // other

		}

		return '<div class="cmenuItem" item_id="' + i + '" ' +
			(a.disabled? 
				// Недоступный элемент
				'style="color:#808080;" ':
				// Доступный элемент
				'onclick="$.cmenu.exec(this);" ' +

				//'onclick="$.cmenu.exec(' + x.id + ',\'' + i + '\');" ' +
				(a.submenu?
				// Есть подменю
				get_caller(a.submenu, 'hovertimeout'):
				// Нет подменю
				' onmouseover="$.cmenu.to=setTimeout(function(){var m = $.cmenu.get_menu(' + menu.id + ');m && m.sub && $.cmenu.hide_menu(m.sub);},300);" onmouseout="clearTimeout($.cmenu.to);" ')
			) +
		'><div class="cmenuIcon">' +
		(a.icon ? cm_img(a.icon, ' ') : '') +
		'</div><div class="cmenuTitle"> ' + caption +
		'</div><div class="submenuBullet ' + (a.submenu ? 'hasSubmenu' : '') + '">' +
		'</div></div>';
		/* }}} */
	}

	function render_menu(menu) {			/* Render menu items	{{{ */
		if (!handle_userfunc(menu) || !handle_async(menu) || !handle_rendered(menu)) {
			return false;
		}

		if (menu.type === 'radio') {
			var radio = menu.get();
		} else {
			radio = false;
		}
		var h = '';
		for (var i in menu.a) {
			if (menu.a[i]) {
				h += render_item(menu, i, radio);
			}
		}
		menu.jq.html(h);
		/* }}} */
	}

	$.cmenu = {
		c: [],
		exec: function (item_element) {		/* Execute action	{{{ */
			item_element = $(item_element);
			var act = item_element.attr('item_id');
			var id = item_element.parent().attr('iuid');

			var m = $.cmenu.c[id];
			if (!m) {
				alert('Menu not found');
				return false;
			}
			if (!m.a || !m.a[act]) {
				alert('Action not found');
				return false;
			}
			if (m.type === 'radio') {
				m.set(m.a[act].caption);
				render_menu(m);
				return false;
			}
			if ($.isFunction(m.a[act].execute) && !m.a[act].disabled) {
				m.a[act].execute.apply(globals.activeModule, [m.a[act], m, m.p]);
				hide_all();
			}
			/* }}} */
		},
		/**
		 * Function get_menu returns menu from
		 * @param initializer mixed
		**/
		get_menu: function (initializer) {
			return (
				(typeof initializer).search(/function|object|undefined/) === -1 ?
				this.c[initializer] : create_cmenu_object(initializer)
			);
		},
		hide_menu: function (m) {		/* {{{ */
			if (!m || !m.v) {
				return;
			}
			m.v = false;
			this.hide_menu(m.sub);
			if (m.caller) {
				$(m.caller).removeClass(cls_item_with_submenu);
			}
			m.jq.hide();
			/* }}} */
		},
		show: function (menu, parentNode, position) {			/* Show menu near parentNode	{{{ */
			if (typeof menu !== 'object') {
				menu = this.get_menu(menu);
			}
			if (typeof position === 'undefined') {
				position = 'left';
			}
			// return if menu already displayed near element parentNode
			if (menu.v && menu.caller === parentNode) {
				return false;
			}
			// we need to hide all displayed menus on mouse click
			if (!this.hideBinded) {
				this.hideBinded = true;
				$().bind('click', hide_all);
			}
			var prev_caller = menu.caller;
			menu.caller = parentNode;
			if (menu.sub) {
				this.hide_menu(menu.sub);
			}
			var jqp = $(parentNode);
			// Если вызвавший меню элемент - элемент меню (то есть показываем подменю)
			// то надо оставить p подсвеченным (класс cmenuItemWithSub);
			// также надо установить родительскому меню ссылку на дочернее, а дочернему - на родителя
			// и еще - если у нашего меню уже есть подменю - скрыть его
			if (jqp.hasClass(cls_item) && !jqp.hasClass(cls_item_with_submenu)) {
				jqp.addClass(cls_item_with_submenu);
				var pm = $.cmenu.get_menu(parseInt($(parentNode.parentNode).attr('iuid'), 10));
				if (pm) {
					if (pm.sub) {
						if (pm.sub === menu) {
							$(prev_caller).removeClass(cls_item_with_submenu);
						} else {
							$.cmenu.hide_menu(pm.sub);
							if ($.cmenu.to && clearTimeout($.cmenu.to)) {
								delete $.cmenu.to;
							}
						}
					}
					pm.sub = menu;
					menu.parentMenu = pm;
				}
			}

			menu.p = get_path(parentNode);
			menu.parent_item = menu.p[menu.p.length - 1].cmenu_item;
			render_menu(menu);

			if (menu.jq[0].offsetParent !== menu.p[0].offsetParent) {
				menu.jq.appendTo(menu.p[0].offsetParent);
			}

			// Display menu
			if (menu.jq.css('display') === 'none') {
				menu.jq.show();
			}

			// Calculate menu parameters
			var cmenuOffParent = menu.jq[0].offsetParent;
			var cmenuWidth = menu.jq[0].offsetWidth;
			var cmenuHeight = menu.jq[0].offsetHeight;

			// Calc visible screen bounds (this code is common)
			var w = 0, h = 0;
			if (typeof(window.innerWidth) === 'number') {// не msie
				w = window.innerWidth;
				h = window.innerHeight;
			} else if (document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
				w = document.documentElement.clientWidth;
				h = document.documentElement.clientHeight;
			}
			var sx = 0, sy = 0;
			if (typeof window.pageYOffset === 'number') {
				sx = window.pageXOffset;
				sy = window.pageYOffset;
			} else if (document.body && (document.body.scrollLeft || document.body.scrollTop)) {
				sx = document.body.scrollLeft;
				sy = document.body.scrollTop;
			} else if (document.documentElement && (document.documentElement.scrollLeft || document.documentElement.scrollTop)) {
				sx = document.documentElement.scrollLeft;
				sy = document.documentElement.scrollTop;
			}
			var winHeight = h + sy;
			var winWidth = w + sx;

			// Получаем абсолютное смещение элемента, вызвавшего меню (p)
			// относительно cmenuOffParent
			var off = get_offset(parentNode, cmenuOffParent);
			if (position == 'left') {
				// Очень важный момент - в какую сторону показывать меню (по горизонтали)
				// Задача - если есть место чтобы показать справа от объекта
				//	- показываем справа: left = off.x+p.offsetWidth
				// если места справа нет
				// - показываем слева: left = off.x-cmenuWidth
				// Наличие места вычисляем исходя из
				// - размеров блока меню (cmenuWidth)
				// - смещению (off.x) родительского элемента относительно общего offsetParent-а (cmenuOffParent)
				// - ширине экрана (winWidth)
				menu.jq.css('left',
					cmenuOffParent.offsetLeft + off.x + parentNode.offsetWidth + cmenuWidth > winWidth ?
					off.x - cmenuWidth : off.x + parentNode.offsetWidth);
				// Еще один очень важный момент - в какую сторону показывать меню (по вертикали)
				// Задача - если есть место чтобы показать снизу от объекта
				//	- показываем снизу: top = off.y-2
				// если места снизу нет 
				// - показываем сверху: top = off.y-cmenuHeight+p.offsetHeight+4
				// Наличие места вычисляем исходя из
				// - размеров блока меню (cmenuHeight)
				// - смещению (off.y) родительского элемента относительно общего offsetParent-а (cmenuOffParent)
				// - высоте экрана (winHeight)
				menu.jq.css('top',
					cmenuOffParent.offsetTop + off.y + cmenuHeight > winHeight ?
					off.y - cmenuHeight + parentNode.offsetHeight + 2 : off.y + 1);
			} else {
				menu.jq.css('left', off.x);
				menu.jq.css('top', off.y + 1 + parentNode.offsetHeight);
			}
			// Устанавливаем флаг видимости меню
			menu.v = true;
			/* }}} */
		}
	};

	$.fn.bindMenu = function (event, menu, position) {/* jQuery-plugin for menu binding	{{{ */
		if (arguments.length === 1) {
			menu = event;
			event = 'mousedown';
		}
		if (!menu.jq) {
			menu = $.cmenu.get_menu(menu);
		}
		return this.each(function () {
			$(this).bind(event, function () {
				hide_all();
				$.cmenu.lockHiding = true;
				$.cmenu.show(menu, this, position);
				return false;
			})
			.bind('mouseout', function () {
				$.cmenu.lockHiding = false;
			})
			.bind('click', function () {return false;});
		});
		/* }}} */
	};

	$(document).click(function () {
	   hide_all();
	});
})(jQuery);
/* :folding=explicit:*/
