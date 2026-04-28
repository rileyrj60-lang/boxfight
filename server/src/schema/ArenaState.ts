import { MapSchema, Schema, type } from '@colyseus/schema';
import { BuildPieceState } from './BuildPieceState';
import { PlayerState } from './PlayerState';

export class ArenaState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: BuildPieceState }) builds = new MapSchema<BuildPieceState>();
  @type('number') tick = 0;
  @type('string') matchState = 'waiting';
  @type('string') winnerId = '';
  @type('number') winsRequired = 3;
}
