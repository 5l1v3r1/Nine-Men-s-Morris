// var GAME = $scope.GAME = {
var GAME = {
  init : function() {
    this.players        = [];
    // this.players[0]     = new AI('Daenerys', true);
    // this.players[1]     = new AI('Jon Snow', false);
    // this.players[1]     = new Human('jon', false);
    this.players[0]     = new Network('http://localhost', '5000', 'Daenerys', true);
    this.players[1]     = new Network('http://localhost', '5000', 'Jon Snow', false);
    this.currentPlayer  = this.players[Math.round(Math.random())];
    this.winMessage     = false;
    this.newGameButton  = false;
    this.catchCountdown = 50; // 50 moves without a catch                                 = tie
    this.finalCountdown = 10; // 10 moves when both players only have 3 pieces remaining  = tie
    var boardSize       = 24;
    this.boardSize      = boardSize;
    this.board          = [];
    this.boardHistory   = []; // The board is the same for three times                    = tie
    this.speed          = 100;
    while(boardSize--) this.board.push(undefined);
    this.graph = [
                    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
                    [1, 9], [3, 11], [5, 13], [7, 15],
                    [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 8],
                    [9, 17], [11, 19], [13, 21], [15, 23],
                    [16, 17], [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [23, 16]
                 ];
    this.graphLength = this.graph.length;
    this.lines = [[0, 1, 2], [2, 3, 4], [4, 5, 6], [0, 7, 6],
                 [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8],
                 [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16],
                 [1, 9, 17], [3, 11, 19], [5, 13, 21], [7, 15, 23]];
    this.intersection = [1, 9, 17, 3, 11, 19, 5, 13, 21, 7, 15, 23];
    UI.init(this.boardSize);

    // When user click on canvas to play
    UI.Pieces.piecesCanvas.addEventListener('click', this.listenClick);

    this.run();
  },
  listenClick : function(event) {
    var isHuman = GAME.currentPlayer.type === 'human';
    if(isHuman) {
      GAME.currentPlayer.pickPosition(event);
    }
  },
  run : function() {
    var isAI = this.currentPlayer.type === 'AI';
    var isNetwork = this.currentPlayer.type === 'network';
    // If it's an AI he has to pick a position
    // If it's a human, we wait for him to click
    if(isAI || isNetwork) {
      var position = this.currentPlayer.pickPosition();
    }
  },
  setPieceOnPosition : function(position) {
    if (this.isValidPosition(position)) {
      this.checkGameState(position);
    } else {

      var isNetwork = this.currentPlayer.type === 'network';
      var isAI = this.currentPlayer.type === 'AI';

      if(isAI || isNetwork) { // If it's not a valid position, generate another one
        this.currentPlayer.pickPosition();
      }
    }
  },
  checkGameState : function(position) {
    var currentPlayer  = this.currentPlayer;

    // if hasToDestroyEnemyPiece is set to true we can't pass to the next turn,
    // we have to wait for the user (human) to do something else (i.g. choose a piece to destroy)
    this.hasToDestroyEnemyPiece = this.hasToDestroyEnemyPiece || false;

    if(this.hasToDestroyEnemyPiece) {
      this.destroyPiece(position);
      this.hasToDestroyEnemyPiece = false;
    } else {
      if(this.getCurrentPhase() === PHASE.PLACING) {
        this.board[position] = currentPlayer.marker;
        UI.Pieces.drawPiece(position, currentPlayer.marker);
        currentPlayer.stockPieces--;

        this.isDestructionOption(position);
      } else if(this.getCurrentPhase() === PHASE.MOVING ) {
        var isAI = this.currentPlayer.type === 'AI';
        var isNetwrok = this.currentPlayer.type === 'network';
        if(isAI || isNetwrok) {
          this.board[position] = currentPlayer.marker;
          UI.Pieces.drawPiece(position, currentPlayer.marker);
        }
        this.isDestructionOption(position);
      } else if(this.getCurrentPhase() === PHASE.FLYING) {
        var isAI = this.currentPlayer.type === 'AI';
        var isNetwrok = this.currentPlayer.type === 'network';
        if(isAI || isNetwrok) {
          this.board[position] = currentPlayer.marker;
          UI.Pieces.drawPiece(position, currentPlayer.marker);
        }
        this.isDestructionOption(position);
      }
    }

    if(!this.hasToDestroyEnemyPiece) {
      this.endTurn();
    }
  },
  endTurn : function() {
    var tie = this.checkTie();
    if(tie) {
      this.endGame(tie);
    } else {
      this.updatePlayerPhase(this.getEnemy());  // Update the enemy phase, if necessary
      var enemyHasLost = this.checkEnemyFail(); // Check if the enemy loose or not
      if(enemyHasLost) {
        this.endGame();
      } else {
        this.changePlayer(); // Change player
        //this.run();
        // Ugly hack to update the display..
        setTimeout(function(_this) { GAME.$scope.$apply(_this.run());}, GAME.speed, this);
      }
    }
  },
  getCurrentPhase : function(player) {
    player  = player || this.currentPlayer;

    var isPlacingPhase = player.phase.value === PHASE.PLACING.value;
    if(isPlacingPhase)
      return PHASE.PLACING;

    var isMovingPhase  = player.phase.value === PHASE.MOVING.value;
    if(isMovingPhase)
      return PHASE.MOVING;

    var isFlyingPhase  = player.phase.value === PHASE.FLYING.value;
    if(isFlyingPhase)
      return PHASE.FLYING;
  },
  /**
   * If necessary, update the player game phase
   */
  updatePlayerPhase : function(player) {
    var player = player || this.currentPlayer;

    if(this.getCurrentPhase(player) === PHASE.PLACING) {
      var playerHasNoPiecesInStock = player.stockPieces === 0;
      if(playerHasNoPiecesInStock) {
        player.phase = PHASE.MOVING;
      }
    } else if(this.getCurrentPhase(player) === PHASE.MOVING) {
      var playerHasLessThanThreePieces = this.countPiecesOnBoard(player) === 3;
      if(playerHasLessThanThreePieces) {
        player.phase = PHASE.FLYING;
      }
    }
  },
  /**
   * After each turn, check if the game is in a tie state
   */
  checkTie : function() {
    var result;

    var isNotPlacingPhase = this.currentPlayer.phase !== PHASE.PLACING;
    if(isNotPlacingPhase) {
      this.catchCountdown--;
    }

    var isBothFlyingPhase = this.currentPlayer.phase === PHASE.FLYING
                        &&  this.getEnemy().phase    === PHASE.FLYING;
    if(isBothFlyingPhase) {
      this.finalCountdown--;
    }

    if(this.catchCountdown === 0) {
      result = 'Tie: 50 moves without a catch';
    } else if(this.finalCountdown === 0) {
      result = 'Tie: 10 moves on the flying phase';
    } else {
      var placingPhaseIsOver = this.currentPlayer.stockPieces === 0
                            && this.getEnemy().stockPieces    === 0;
      if(placingPhaseIsOver) {
        if(this.isBoardTheSameForThreeTimes()) {
          result = 'Tie: The board is the same for three times';
        } else {
          this.boardHistory.push(this.board.toString());
        }
      }
    }

    return result;
  },

  isBoardTheSameForThreeTimes : function() {
    var currentBoard = this.board.toString();
    var countSameBoards = _.filter(this.boardHistory, function(board) {
      return board === currentBoard;
    }).length;

    var threeTimes = countSameBoards == 2 ? true : false;
    return threeTimes;
  },
  /**
   * After each turn, check if the enemy fails or not
   */
  checkEnemyFail : function() {
    var enemyIsNotInFlyingPhase = this.getEnemy().phase !== PHASE.FLYING;
    var hasLost = this.enemyHasLessThanThreePieces() ||
      (this.isEnemySurrounded() && enemyIsNotInFlyingPhase);
    return hasLost;
  },
  enemyHasLessThanThreePieces : function() {
    var hasLessThanThreePieces = false;
    var piecesOnBoard = this.countPiecesOnBoard(this.getEnemy());
    if (piecesOnBoard + this.getEnemy().stockPieces < 3) {
      hasLessThanThreePieces = true;
    }

    return hasLessThanThreePieces;
  },
  isEnemySurrounded: function() {
    var isSurrounded = false;
    var enemy = !this.currentPlayer.marker;
    var enemyMovement = 0;
    var fail = false;

    _.each(this.board, function(marker, index) {
      if(enemy === marker) {
        _.each(this.graph, function(connection) {
          var isPathFromCurrentPosition = _.contains(connection, index);
          var neighborAvailable = this.board[_.without(connection, index)[0]] === undefined;
          if (isPathFromCurrentPosition && neighborAvailable) {
            enemyMovement++;
          }
        }, this);
      }
    }, this);

    var enemyIsStuck = enemyMovement === 0;
    var enemyNoPiecesInStock = this.getEnemy(this.currentPlayer).stockPieces === 0;
    if(enemyIsStuck && enemyNoPiecesInStock) {
      isSurrounded = true;
    }

    return isSurrounded;
  },
  countPiecesOnBoard: function(player) {
    player = player || this.currentPlayer;
    var piecesOnBoard = _.filter(this.board, function(marker) {
      return marker === player.marker;
    }, this).length;

    return piecesOnBoard;
  },
  isValidPosition : function(position, hasToBeEmptyPosition) {
    var isBadPosition = position === undefined || position < 0 || position > (this.boardSize - 1);
    var hasToDestroyEnemyPiece = this.hasToDestroyEnemyPiece;

    // Ask to be an empty position
    if(hasToBeEmptyPosition === undefined && !hasToDestroyEnemyPiece) {
      hasToBeEmptyPosition = true;
    }

    if (hasToDestroyEnemyPiece) {
      var isNotEnemyPiece = this.board[position] !== !this.currentPlayer.marker;
      var isEnemyPiece = !isNotEnemyPiece;
      var lineEnemyComplete = isEnemyPiece && this.isLineComplete(position);

      if (isNotEnemyPiece || lineEnemyComplete) {
        isBadPosition = true;
      }
    }
    if (hasToBeEmptyPosition) {
      isBadPosition = isBadPosition || this.board[position] !== undefined;
    }

    return !isBadPosition;
  },
  isValidMovement : function(origin, destination) {
    var result             = false;
    var originIsOwnPiece   = this.board[origin] === this.currentPlayer.marker;
    var destinationIsEmpty = this.board[destination] === undefined;
    var isMovingPhase      = this.currentPlayer.phase === PHASE.MOVING;
    var isFlyingPhase      = this.currentPlayer.phase === PHASE.FLYING;
    var isNeighborPosition = this.isNeighbor(origin, destination);

    if (originIsOwnPiece && destinationIsEmpty
        && ((isMovingPhase && isNeighborPosition) || isFlyingPhase)) {
      result = true;
    }

    return result;
  },
  movePiece : function(origin, destination) {
    var currentMarker = this.currentPlayer.marker;
    this.board[origin] = undefined;
    this.board[destination] = currentMarker;

    UI.Pieces.unselectPiece(origin, currentMarker);
    UI.Pieces.clearPiece(UI.Board.points[origin]);
    UI.Pieces.drawPiece(destination, currentMarker);
  },
  isNeighbor : function(origin, destination) {
    var isValid = false;

    _.each(this.graph, function(element) {
      if (!isValid) {
        if (element[0] === origin && element[1] === destination) {
          isValid = true;
        } else if (element[1] === origin && element[0] === destination) {
          isValid = true;
        }
      }
    });

    return isValid;
  },
  isLineComplete : function(position) {
    var result = false;
    _.each(this.lines, function(line) {
      if(_.contains(line, position)) {
        if(this.board[line[0]] === this.board[line[1]] && this.board[line[1]] === this.board[line[2]]) {
          result = true;
        }
      }
    }, this);
    return result;
  },
  isDestructionOption : function(position) {
    if (this.isLineComplete(position) && this.canRemoveEnemyPiece()) {
      // We reset the catchCountdown when a mill is done
      this.catchCountdown = 50;
      // We reset the board history, because board can't be the same
      // with one less piece.
      this.boardHistory   = [];

      isAI = this.currentPlayer.type === 'AI';
      isNetwork = this.currentPlayer.type === 'network';
      if (isAI || isNetwork) {
        var pieceToBeDestroyed = this.currentPlayer.selectEnemyPiece();
        console.warn(this.currentPlayer.username + ' Destroy ' + pieceToBeDestroyed);
        if (pieceToBeDestroyed !== undefined) {
          this.destroyPiece(pieceToBeDestroyed);
        }
      } else {
        // Do something on the ui to say to the user to choose an enemy piece
        this.hasToDestroyEnemyPiece = true;
        GAME.$scope.$apply();
      }
    }
  },
  destroyPiece : function(pieceToBeDestroyed) {
    this.board[pieceToBeDestroyed] = undefined;
    UI.Pieces.clearPiece(UI.Board.points[pieceToBeDestroyed]);
  },
  /**
   * canRemoveEnemyPiece return true if an enemy piece can be remove
   * It return false if no enemy piece can be remove (e.g. all enemy pieces are
   * in an complete line)
   * @return {[type]} [description]
   */
  canRemoveEnemyPiece: function() {
    var result = false;
    var isEnemyPiece, isLineIncomplete;
    _.each(this.board, function(marker, index) {
      isEnemyPiece     = marker === !this.currentPlayer.marker;
      isLineIncomplete = !this.isLineComplete(index);
      if (isEnemyPiece && isLineIncomplete) {
        result = true;
      }
    }, this);

    return result;
  },
  changePlayer : function() {
    this.currentPlayer = this.getEnemy();
  },
  getEnemy: function() {
    if(this.currentPlayer === this.players[0])
      return this.players[1];
    else
      return this.players[0];
  },
  endGame : function(message) {
    this.newGameButton = true;
    this.winMessage = message || this.currentPlayer.username + ' won!';
    UI.Pieces.piecesCanvas.removeEventListener('click', this.listenClick);
    this.$scope.$apply();
  },

  newGame : function() {
    this.newGameButton = false;
    this.init();
    this.run();
  }
};


angular.module('ngWindmill',[])
       .controller('ngWindmillCtrl', function($scope) {

  $scope.title = 'Windmill';
  $scope.GAME = GAME;

  // Little hack because we need the $scope in our GAME
  GAME.$scope = $scope;

  GAME.init();
});

//--------------- GRAPH: DO NOT DELETE THIS SCHEMA ------------
//     0------------1------------2
//     |            |            |
//     |   8--------9------10    |
//     |   |        |       |    |
//     |   |   16--17--18   |    |
//     |   |   |        |   |    |
//     7---15--23      19--11----3
//     |   |   |        |   |    |
//     |   |   22--21--20   |    |
//     |   |        |       |    |
//     |   14------13------12    |
//     |            |            |
//     6------------5------------4