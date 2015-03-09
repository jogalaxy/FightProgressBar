// ==UserScript==
// @name         Leek Wars Fight Progress Bar
// @namespace    Fightcontainer
// @downloadURL  https://raw.githubusercontent.com/jogalaxy/FightProgressBar/master/FightProgressBarUserScript.js
// @updateURL    https://raw.githubusercontent.com/jogalaxy/FightProgressBar/master/FightProgressBarUserScript.js
// @version      0.9.7
// @description  This plugin adds an awesome progress bar to the fight viewer.
// @author       jojo123 and Charlesfire
// @match        http://leekwars.com/fight/*
// @require      https://raw.githubusercontent.com/shutterstock/rickshaw/master/vendor/d3.min.js
// @require      https://raw.githubusercontent.com/shutterstock/rickshaw/master/vendor/d3.layout.min.js
// @require      https://raw.githubusercontent.com/shutterstock/rickshaw/master/rickshaw.min.js
// @grant        none
// ==/UserScript==

var Fightcontainer = (function()
{

	// Armes du jeu

	var WEAPONS = [
		Pistol, // 1
		MachineGun, // 2
		DoubleGun, // 3
		Shotgun,  // 4
		Magnum, // 5
		Laser, // 6
		GrenadeLauncher, // 7
		FlameThrower, // 8
		Destroyer, // 9
		Gazor, // 10
		Electrisor, // 11
		MLaser, // 12
		BLaser // 13
	];

	// Liste des poireaux

	var leeks = [];

	for (var i = 0; i < game.data.leeks.length; i++)
	{
		leeks[game.data.leeks[i].id] = {
			"absoluteShield" : 0,
			"relativeShield" : 0,
			"active" : (game.data.leeks[i].type == 0)?true:false,
			"life" : game.data.leeks[i].life,
			"maxLife" : game.data.leeks[i].life,
			"pt" : game.data.leeks[i].pt,
			"pm" : game.data.leeks[i].pm,
			"agility" : game.data.leeks[i].agility,
			"force" : game.data.leeks[i].force,
			"cell" : game.data.leeks[i].cellPos,
			"weapon" : undefined,
			"effects"  : []
		}

		// Correction bug Firefox
		game.leeks[i].draw1 = game.leeks[i].draw;
		game.leeks[i].draw = function()
		{
			if (!this.dead) this.draw1();
		}
	};

	// Intialisation des variables

	var currentTurn = 1;
	var currentPlayer = 0;
	var actionStatus = [];
	var effects = [];

	// On joue la match action par action

	$.each(game.data.actions, function(key, action)
	{
		var type = action[0];

		switch (type)
		{

			case ACTION_NEW_TURN:
				currentTurn = action[1];
				break;

			case ACTION_LEEK_TURN:
				currentPlayer = action[1];
				break;

			case ACTION_END_TURN:
				leeks[action[1]].tp = action[2];
				leeks[action[1]].mp = action[3];
				break;

			case ACTION_MOVE_TO:
				leeks[action[1]].cell = action[2];
				break;

			case ACTION_PM_LOST:
				leeks[action[1]].mp -= action[2];
				break;

			case ACTION_CARE:
				leeks[action[1]].life += action[2];
				break;

			case ACTION_BOOST_VITA:
				leeks[action[1]].life += action[2];
				leeks[action[1]].maxLife += action[2];
				break;

			case ACTION_SET_WEAPON:
				leeks[action[1]].weapon = action[2];
				break;

			case ACTION_LIFE_LOST:
				leeks[action[1]].life -= action[2];
				break;

			case ACTION_PT_LOST:
				leeks[action[1]].tp -= action[2];
				break;

			case ACTION_PLAYER_DEAD:
				leeks[action[1]].life = 0;
				break;

			case ACTION_USE_CHIP:
				if (action[4] == 0) // Pas d'échec
				{
					if (action[3] == 39) // Inversion
					{
						if (action[5].length > 0)
						{
							leeks[action[5][0]].cell = leeks[action[1]].cell;
							leeks[action[1]].cell = action[2];
						}
					}
					if (action[3] == 37) // Téléportation
					{
						leeks[action[1]].cell = action[2];
					}
				}
				break;

			case ACTION_SUMMONING:
				leeks[action[2]].active = true;
				leeks[action[2]].cell = action[3];
				break;

			case ACTION_ADD_WEAPON_EFFECT:
				var img = ["1", "2", "3", "4", "5", "6", "7", "flamme", "9", "gaz_icon", "11", "12"][action[1] - 1];
				leeks[action[4]].effects[action[2]] = {id: action[2], type: "weapon", target: action[4], action: action};
				effects[action[2]] = {id: action[2], type: "weapon", target: action[4], action: action};
				break;

			case ACTION_ADD_CHIP_EFFECT:
				leeks[action[4]].effects[action[2]] = {id: action[2], type: "chip", target: action[4], action: action};
				effects[action[2]] = {id: action[2], type: "chip", target: action[4], action: action};
				break;

			case ACTION_REMOVE_EFFECT:
				delete leeks[effects[action[1]].target].effects[action[1]];
				delete effects[action[1]];
				break;

			case ACTION_RESURRECTION:
				leeks[action[2]].cell = action[3];
				leeks[action[2]].life = action[4];
				leeks[action[2]].maxLife = action[5];
				leeks[action[2]].active = true;
				break;

		}

		// On sauvegarde l'état après l'action

		actionStatus[key] = {
			"type" : type,
			"currentTurn" : currentTurn,
			"currentPlayer" : currentPlayer,
			"leeks" : clone(leeks)
		};

	});

	// Fonction pour cloner un objet

	function clone(obj)
	{
		return JSON.parse(JSON.stringify(obj));
	}

	// Fonction pour aller de nouveau à une action précise

	function goToAction(action)
	{
		showPlayerName(action);
		$("#actions .action").remove();
		$("#logs .log").remove();
		$("[id^=effect]").remove();
		for (var effect in game.effects) { game.removeEffect(effect); }
		for (var i = 0; i < game.particles.particles.length; i++) { game.particles.particles.splice(i, 1); i--; }
		game.markers = [];
		game.currentTurn = actionStatus[action].currentTurn;
		game.turn = actionStatus[action].currentTurn;
		game.currentPlayer = actionStatus[action].currentPlayer;
		game.currentAction = action;
		for (var i = 0; i < leeks.length; i++)
		{
			game.leeks[i].absoluteShield = actionStatus[action].leeks[i].absoluteShield;
			game.leeks[i].relativeShield = actionStatus[action].leeks[i].relativeShield;
			game.leeks[i].active = actionStatus[action].leeks[i].active;
			game.leeks[i].life = actionStatus[action].leeks[i].life;
			game.leeks[i].maxLife = actionStatus[action].leeks[i].maxLife;
			game.leeks[i].pt = actionStatus[action].leeks[i].pt;
			game.leeks[i].pm = actionStatus[action].leeks[i].pm;
			game.leeks[i].agility = actionStatus[action].leeks[i].agility;
			game.leeks[i].strength = actionStatus[action].leeks[i].force;
			game.leeks[i].setCell(actionStatus[action].leeks[i].cell);
			if (game.leeks[i].life > 0)
			{
				game.leeks[i].dead = false;
				game.leeks[i].bubble = new Bubble();
				$('#entity-info-'+game.leeks[i].id).removeClass('dead');
			}
			else
			{
				game.leeks[i].dead = true;
				game.leeks[i].deadAnim = 0;
				game.leeks[i].bubble = null;
			}

			if (actionStatus[action].leeks[i].weapon === undefined)
			{
				game.leeks[i].weapon = undefined;
			}
			else
			{
				game.leeks[i].weapon = new WEAPONS[actionStatus[action].leeks[i].weapon - 1]();
			}

			if (!game.leeks[i].active)
			{
				if (game.leeks[i].drawID)
				{
					game.hud.removeEntityBlock(game.leeks[i]);
					game.removeDrawableElement(game.leeks[i].drawID, game.leeks[i].y);
					game.leeks[i].drawID = null;
				}
			}
			else
			{
				if (game.leeks[i].drawID === null && game.leeks[i].life)
				{
					if (game.leeks[i].summon) game.hud.addEntityBlock(game.leeks[i]);
					game.leeks[i].drawID = game.addDrawableElement(game.leeks[i], game.leeks[i].y);
				}
			}

			if (game.leeks[i].dead)
			{
				if (game.leeks[i].drawID !== undefined)
				{
					if (game.leeks[i].summon) game.hud.removeEntityBlock(game.leeks[i]);
					game.removeDrawableElement(game.leeks[i].drawID, game.leeks[i].y);
					game.leeks[i].drawID = null;
				}
			}

			$.each(actionStatus[action].leeks[i].effects, function(key, effect)
			{
				if (effect)
				{
					game.addEffect(effect.action, effect.type);
				}

			});

			game.leeks[i].moveDelay = 0;
			game.leeks[i].path = [];

			game.leeks[i].draw();
		}

		game.showCellTime = 0;
		for (var c = 0; c < game.chips.length; ++c)
		{
			game.chips[c].done = true;
		}
		game.actionToDo = true;
		game.actionDelay = 6;
		$('#turn').text("");
		game.hud.refresh();
		game.draw();

	}

	function showPlayerName(action)
	{

		var actionForName = action;
		if (actionStatus[action].type == ACTION_NEW_TURN)
		{
			// si le type est ACTION_NEW_TURN, le nom du joueur dans le tableau d'actions est encore celui du tour précédent.
			// incrémente de 1 pour avoir le bon nom
			actionForName++;
		}
		var leek = game.leeks[actionStatus[actionForName].currentPlayer];
		$('#player-name').css('color', teamColors[leek.team]);
		$('#player-name').html(leek.name);
	}

	function goToActionFromTurnAndPlayerName(turn, playerName)
	{
		var startTurn = 0;
		for (var i = 0; i < actionStatus.length; i++)
		{
			if (actionStatus[i].currentTurn == turn && startTurn == 0)
				startTurn = i;
			/*if (actionStatus[i].currentTurn == turn && game.leeks[actionStatus[i].currentPlayer].name == playerName)
			{
				startTurn = i-1;
				break;
			}*/
		}
		if (startTurn != 0)
		{
			goToAction(startTurn);
			$("#actions .action").remove();
			$("#logs .log").remove();
			$("[id^=effect]").remove();
		}
		refreshHud();
	}

	function goToPreviousTurn()
	{
		if (game.turn <= 2)
		{
			goToAction(0);
		}
		else
		{
			var previousTurn = game.turn - 1;
			for (var i = game.currentAction; i >= 0; i--)
			{
				if (actionStatus[i].currentTurn == previousTurn - 1)
				{
					goToAction(i+1);
					break;
				}
			}
		}
		refreshHud();
	}

	function goToNextTurn()
	{
		var nextTurn = game.turn + 1;
		for (var i = game.currentAction; i < actionStatus.length; i++)
		{
			if (actionStatus[i].currentTurn == nextTurn)
			{
				goToAction(i);
				break;
			}
		}
		refreshHud();
	}

	function goToPreviousPlayer()
	{
		var previousPlayer = undefined;
		for (var i = game.currentAction; i >= 0; i--)
		{
			if (previousPlayer !== undefined && actionStatus[i].currentPlayer != previousPlayer)
			{
				goToAction(i+1);
				break;
			}
			if (actionStatus[i].currentPlayer != game.currentPlayer)
			{
				previousPlayer = actionStatus[i].currentPlayer;
			}
		}
		refreshHud();
	}

	function goToNextPlayer()
	{
		for (var i = game.currentAction; i < actionStatus.length; i++)
		{
			if (actionStatus[i].currentPlayer != game.currentPlayer)
			{
				goToAction(i);
				break;
			}
		}
		refreshHud();
	}

	// Interface

	var teamColors = ["#FFFFFF", "#0000FF", "#FF0000"];
	var popup = document.createElement("DIV");
	var hud = document.getElementById("hud");
	var container = document.createElement("DIV");
	var progressBar = document.createElement("DIV");

	popup.style.position = "fixed";
	popup.style.display = "none";
	popup.style.border = "4px solid #BBBBBB";
	popup.style.borderRadius = "2px";
	popup.style.backgroundColor = "#BBBBBB";
	popup.style.boxShadow = "4px 4px 2px rgba(0, 0, 0, 0.3)";
	popup.style.zIndex = 999;

	progressBar.style.width = "0%";
	progressBar.style.height = "15px";
	progressBar.style.backgroundColor = "#00BB00";
	progressBar.style.clear = "left";

	container.style.width = "100%";
	container.style.backgroundColor = "#D1D1D1";
	container.style.position = "absolute";
	container.style.bottom = "0px";
	container.style.zIndex = 998;

	document.getElementById("fight").style.borderBottom = "0px none #000000";
	document.getElementById("bottom-part-wrapper").style.bottom = "15px";
	document.getElementById("actions-wrapper").style.bottom = "15px";
	document.getElementById("logs-wrapper").style.bottom = "15px";

	container.appendChild(progressBar);
	$(hud).prepend(container);
	$(hud).prepend(popup);

	var isMouseDown = false;

	$(container).mousedown(function(e)
	{
		e.preventDefault();
		isMouseDown = true;
		var percentage = ((e.clientX - $(container).offset().left)/container.offsetWidth);
		percentage = Math.max(Math.min(percentage, 1), 0);
		goToAction(Math.round(percentage * game.actions.length));
		refreshHud();
		game.pause();
	});

	$(document).mouseup(function(e)
	{
		isMouseDown = false;
	});

	$(container).mouseup(function(e)
	{
		var percentage = ((e.clientX - $(container).offset().left)/container.offsetWidth);
		percentage = Math.max(Math.min(percentage, 1), 0);
		goToAction(Math.round(percentage * game.actions.length));
		refreshHud();
		game.resume();
	});

	$(container).mousemove(function(e)
	{
		e.preventDefault();
		var percentage = ((e.clientX - $(container).offset().left)/container.offsetWidth);
		percentage = Math.max(Math.min(percentage, 1), 0);
        var action = Math.round(percentage * game.actions.length);

		popup.innerHTML = "Tour " + actionStatus[action].currentTurn + "<br/>Action " + action;
		popup.style.left = (e.clientX - popup.offsetWidth / 2) + "px";
		popup.style.top = (e.clientY - popup.offsetHeight - 5) + "px";

		if(isMouseDown == 1)
		{
			goToAction(action);
			refreshHud();
		}
	});

	$(container).mouseenter(function()
	{
		progressBar.style.backgroundColor = "#00DD00";
		popup.style.display = "block";
	});

	$(container).mouseleave(function()
	{
		progressBar.style.backgroundColor = "#00BB00";
		popup.style.display = "none";
	});

	game.actionDone = function()
	{
		game.actionToDo = true;
		game.actionDelay = 6;
		refreshHud();
	}

	game.hud.enterFullscreen = function()
	{
		$('#top-part-wrapper').css('top', 0);
	}

	game.hud.leaveFullscreen = function()
	{
		$('#top-part-wrapper').css('top', -8);
	}

	$('#top-part-wrapper').css('margin-left', -100);
	$('#top-part-wrapper').css('width', 200);
	$('#top-part').prepend('<img class="top-part-action" id="previous-player" src="http://leekwars.com/static/image/icon_play.png" style="transform: rotate(180deg); width: 16px; margin: 0 8px; opacity: 0.6; cursor: pointer;">');
	$('#top-part').prepend('<img class="top-part-action" id="previous-turn" src="http://leekwars.com/static/image/icon_speed.png" style="transform: rotate(180deg); width: 16px; margin: 0 8px; opacity: 0.6; cursor: pointer;">');
	$('#top-part').append('<img class="top-part-action" id="next-player" src="http://leekwars.com/static/image/icon_play.png" style="width: 16px; margin: 0 8px; opacity: 0.6; cursor: pointer;">');
	$('#top-part').append('<img class="top-part-action" id="next-turn" src="http://leekwars.com/static/image/icon_speed.png" style="width: 16px; margin: 0 8px; opacity: 0.6; cursor: pointer;">');
	$('#top-part-wrapper').append($('<div/>').attr('id', 'player-name').css('color', $('#turn').css('color')));

	document.head.insertAdjacentHTML('beforeEnd', '<style>#top-part:before{right: -45px;border-bottom: 45px solid transparent;border-left: 45px solid #D1D1D1;}</style>');
	document.head.insertAdjacentHTML('beforeEnd', '<style>#top-part:after{left: -45px;border-bottom: 45px solid transparent;border-right: 45px solid #D1D1D1;}</style>');

	$('.top-part-action').mouseenter(function()
	{
		popup.style.display = "block";
	});

	$('.top-part-action').mouseleave(function()
	{
		popup.style.display = "none";
	});

	$('.top-part-action').mousemove(function(e)
	{
		e.preventDefault();
		popup.style.left = (e.clientX - popup.offsetWidth / 2) + "px";
		popup.style.top = (e.clientY + popup.offsetHeight - 5) + "px";
		if (e.target.id == "previous-turn") popup.innerHTML = "Tour précédent (c)";
		if (e.target.id == "previous-player") popup.innerHTML = "Joueur précédent (v)";
		if (e.target.id == "next-turn") popup.innerHTML = "Tour suivant (n)";
		if (e.target.id == "next-player") popup.innerHTML = "Joueur suivant (b)";
	});

	$('#previous-turn').click(goToPreviousTurn);

	$('#next-turn').click(goToNextTurn);

	$('#previous-player').click(goToPreviousPlayer);

	$('#next-player').click(goToNextPlayer);

	// Raccourcis clavier

	$(document).keydown(function(event)
	{
		if ($("#comment-input").is(":focus")) return;

		switch (event.key)
		{
			case 'c':
				goToPreviousTurn();
				event.preventDefault();
				break;
			case 'v':
				goToPreviousPlayer();
				event.preventDefault();
				break;
			case 'b':
				goToNextPlayer();
				event.preventDefault();
				break;
			case 'n':
				goToNextTurn();
				event.preventDefault();
				break;
		}
	});

	function refreshHud()
	{
		var percent = game.currentAction/game.actions.length * 100;
		progressBar.style.width = percent + "%";
		if (graphProgress !== undefined) graphProgress.setAttributeNS(null, 'width', percent + "%");

		// affiche le nom du joueur pour l'action suivante
		if ((game.currentAction + 1) < actionStatus.length)
		{
			showPlayerName(game.currentAction + 1);
		}
	}

	var graphProgress = undefined;

	// Graphique

	function loadGraph()
	{

		var graphContainer = document.createElement("DIV");
		graphContainer.style.height = "250px";
		graphContainer.style.backgroundColor = "#F2F2F2";

		var series = [];
		var data = [];
		for (var i = 0; i < game.leeks.length; i++)
		{
			if (!game.leeks[i].summon)
			{
				data = [];
				var thisTurn = 0;
				$.each(actionStatus, function(key, action)
				{
					if (action.currentTurn != thisTurn)
					{
						data.push({x: key + action.currentTurn / 1000, y: action.leeks[i].life});
						thisTurn = action.currentTurn;
					}
					if (key == actionStatus.length - 1)
					{
						data.push({x: key, y: action.leeks[i].life});
					}
				});
				series.push({name: game.leeks[i].name, color: teamColors[game.leeks[i].team], data: data});
			}
		}

		var graph = new Rickshaw.Graph({
			element: graphContainer,
			width: parseInt(document.getElementById("fight-info").offsetWidth),
			renderer: "line",
			series: series
		});

		graph.render();

		var hoverDetail = new Rickshaw.Graph.HoverDetail({
			graph: graph,
			xFormatter: function(x) { return (actionStatus.length-1 == x) ? "Fin" : "Tour " + Math.round((x - Math.floor(x))*1000) },
			yFormatter: function(y) { return y + " pv" }
		});

		$(graphContainer).mousemove(function(e)
		{
			e.preventDefault();
			var percentage = ((e.clientX - $(graphContainer).offset().left)/graphContainer.offsetWidth);
			percentage = Math.max(Math.min(percentage, 1), 0);
			var action = Math.round(percentage * game.actions.length);

			popup.innerHTML = $('#fight-info .detail .x_label').text() + "<br/> " + $('#fight-info .detail .item').text();
			popup.style.left = (e.clientX - popup.offsetWidth / 2) + "px";
			popup.style.top = (e.clientY - popup.offsetHeight - 5) + "px";

			if(isMouseDown == 1)
			{
				goToAction(action);
				refreshHud();
			}
		});

		$(graphContainer).mousedown(function(e)
		{
			e.preventDefault();
			isMouseDown = true;
			var percentage = ((e.clientX - $(graphContainer).offset().left)/graphContainer.offsetWidth);
			percentage = Math.max(Math.min(percentage, 1), 0);
			goToAction(Math.round(percentage * game.actions.length));
			refreshHud();
			game.pause();
		});

		$(graphContainer).mouseup(function(e)
		{
			e.preventDefault();
			isMouseDown = false;
			var percentage = ((e.clientX - $(graphContainer).offset().left)/graphContainer.offsetWidth);
			percentage = Math.max(Math.min(percentage, 1), 0);
			goToAction(Math.round(percentage * game.actions.length));
			refreshHud();
			game.resume();
		});

		$(graphContainer).mouseenter(function()
		{
			popup.style.display = "block";
		});

		$(graphContainer).mouseleave(function()
		{
			popup.style.display = "none";
		});

		graphContainer.style.position = "relative";

		$("#fight-info").prepend(graphContainer);
		$("#fight-info").css({
			position: "relative",
			backgroundColor: "#fff",
			zIndex: 998,
		});

		graphProgress = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
		graphProgress.setAttributeNS(null, 'x', 0);
		graphProgress.setAttributeNS(null, 'y', 0);
		graphProgress.setAttributeNS(null, 'height', '100%');
		graphProgress.setAttributeNS(null, 'width', '0');
		graphProgress.setAttributeNS(null, 'fill', '#000000');
		graphProgress.setAttributeNS(null, 'fill-opacity', 0.5);
		graphContainer.children[0].appendChild(graphProgress);

		$('#fight-info .detail').css("display", "none");

	}

	// Configuration graphique
	var Config_loadGraph = getValue('Config_loadGraph', "1");
	console.log(Config_loadGraph);
	if (Config_loadGraph == "1")
	{
		loadGraph();
		$('#fight-info').append('<div style="background: #222; text-align: center;"><a href="#" id="toggleGraph" style="color: #FFF;">Cacher le graphique</a></div>');
	}
	else
	{
		$('#fight-info').append('<div style="background: #222; text-align: center;"><a href="#" id="toggleGraph" style="color: #FFF;">Afficher le graphique</a></div>');
	}

	$('#toggleGraph').click(function(e)
	{
		e.preventDefault();
		if ($(this).text() == "Cacher le graphique")
		{
			$(this).text("Afficher le graphique");
			setValue('Config_loadGraph', "0");
		}
		else
		{
			$(this).text("Cacher le graphique");
			setValue('Config_loadGraph', "1");
		}
	});

	// Onload
	var intervalInitialized = setInterval(function()
	{
		if (game.initialized)
		{
			clearInterval(intervalInitialized);
			var hash = window.location.hash.substring(1).split("/");
			if (hash.length >= 2)
			{
				var turn = hash[0];
				var playerName = hash[1];
				goToActionFromTurnAndPlayerName(turn, playerName);
			}
		}
	}, 100);

});

// Lancement du UserScript

var intervalFightcontainer = setInterval(function()
{
	if (game.inited)
	{
		clearInterval(intervalFightcontainer);
		Fightcontainer();
	}
}, 100);

// Local Storage

function setValue(aKey, aVal) {
	localStorage.setItem(aKey, aVal);
}

function getValue(aKey, aDefault) {
	var val = localStorage.getItem(aKey);
	if (null === val && 'undefined' != typeof aDefault) return aDefault;
	return val;
}
