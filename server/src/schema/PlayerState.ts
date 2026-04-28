import { Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') sessionId = '';
  @type('string') name = '';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') rx = 0;
  @type('number') ry = 0;
  @type('number') vy = 0;
  @type('boolean') grounded = true;
  @type('number') hp = 100;
  @type('boolean') alive = true;
  @type('number') kills = 0;
}
