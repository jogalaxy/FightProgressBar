
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

var currentTurn = 1;
var currentPlayer = 0;

var leeks = [];

for (var i = 0; i < game.data.leeks.length; i++)
{
	leeks[game.data.leeks[i].id] = {
		"active" : (game.data.leeks[i].type == 0)?true:false,
		"life" : game.data.leeks[i].life,
		"maxLife" : game.data.leeks[i].life,
		"pt" : game.data.leeks[i].pt,
		"pm" : game.data.leeks[i].pm,
		"agility" : game.data.leeks[i].agility,
		"force" : game.data.leeks[i].force,
		"cell" : game.data.leeks[i].cellPos,
		"weapon" : undefined
	}
};

var actionStatus = [];

$.each(game.data.actions, function(key, action)
{
	var type = action[0];

	switch (type)
	{

		// Actions
		case ACTION_NEW_TURN:
			currentTurn = action[1];
			break;

		case ACTION_LEEK_TURN:
			currentPlayer = action[1];
			break;

		case ACTION_END_TURN:
			leeks[action[1]].pt = action[2];
			leeks[action[1]].pm = action[3];
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
			if (action[3] == 39) // Inversion
			{
				leeks[action[5][0]].cell = leeks[action[1]].cell;
				leeks[action[1]].cell = action[2];
			}
			if (action[3] == 37) // Téléportation
			{
				leeks[action[1]].cell = action[2];
			}
			break;

		case ACTION_SUMMONING:
			leeks[action[2]].active = true;
			leeks[action[2]].cell = action[3];
			break;

		case ACTION_ADD_WEAPON_EFFECT:
			break;

		case ACTION_ADD_CHIP_EFFECT:
			break;

		case ACTION_REMOVE_EFFECT:
			break;

	}

	actionStatus[key] = {
		"currentTurn" : currentTurn,
		"currentPlayer" : currentPlayer,
		"leeks" : clone(leeks)
	};

});

function clone(obj)
{
	return JSON.parse(JSON.stringify(obj));
}

function goToAction(action)
{
	$("#actions .action").remove();
	$("#logs .log").remove();
	game.currentTurn = actionStatus[action].currentTurn;
	game.turn = actionStatus[action].currentTurn;
	game.currentPlayer = actionStatus[action].currentPlayer;
	game.currentAction = action;
	for (var i = 0; i < leeks.length; i++)
	{
		game.leeks[i].active = actionStatus[action].leeks[i].active;
		game.leeks[i].life = actionStatus[action].leeks[i].life;
		game.leeks[i].maxLife = actionStatus[action].leeks[i].maxLife;
		game.leeks[i].pt = actionStatus[action].leeks[i].pt;
		game.leeks[i].pm = actionStatus[action].leeks[i].pm;
		game.leeks[i].agility = actionStatus[action].leeks[i].agility;
		game.leeks[i].force = actionStatus[action].leeks[i].force;
		game.leeks[i].setCell(actionStatus[action].leeks[i].cell);
		if (game.leeks[i].life > 0)
		{
			game.leeks[i].dead = false;
			game.leeks[i].bubble = new Bubble();
		}
		else
		{
			game.leeks[i].dead = true;
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
		game.leeks[i].moveDelay = 0;
		game.leeks[i].path = [];
		game.leeks[i].draw();

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
			if (game.leeks[i].drawID === null)
			{
				game.hud.addEntityBlock(game.leeks[i]);
				game.leeks[i].drawID = game.addDrawableElement(game.leeks[i], game.leeks[i].y);
			}
		}

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

//Interface
var container = document.getElementById("fight-info");
var progressBar = document.createElement("DIV");
var insideBar = document.createElement("DIV");
insideBar.style.width = "0%";
insideBar.style.height = "100%";
insideBar.style.backgroundColor = "#00BB00";
progressBar.style.width = "100%";
progressBar.style.height = "15px";
progressBar.style.backgroundColor = "#d1d1d1";

document.getElementById("fight").style.borderBottom = "0px none #000000";
document.getElementById("bottom-part-wrapper").style.bottom = "0px";

$(progressBar).mousedown(function(e)
						{
							var percentage = ((e.clientX - $(progressBar).offset().left)/progressBar.offsetWidth);
							goToAction(Math.round(percentage * game.actions.length));
							insideBar.style.width = (percentage * 100) + "%";
                        });

$(progressBar).mousemove(function(e)
                        {
                             if(e.which == 1)
                             {
                                 var percentage = ((e.clientX - $(progressBar).offset().left)/progressBar.offsetWidth);
                                 goToAction(Math.round(percentage * game.actions.length));
                                 insideBar.style.width = (percentage * 100) + "%";
                             }
                        });
$(progressBar).mouseenter(function()
                         {
                            insideBar.style.backgroundColor = "#00DD00";
                         });
$(progressBar).mouseleave(function()
                         {
							insideBar.style.backgroundColor = "#00BB00";
                         });

progressBar.appendChild(insideBar);
$(container).prepend(progressBar);

game.actionDone = function()
{
	game.actionToDo = true;
	game.actionDelay = 6;
	insideBar.style.width = (game.currentAction/game.actions.length * 100) + "%";
}

