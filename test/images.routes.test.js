import app from '../server/index';
import { expect } from 'chai';
import request from 'supertest';
import * as utils from '../test/utils';
import models from '../server/models';

const application = utils.data('application');
const userData = utils.data('user1');

describe('images.routes.test.js', () => {
  let user;

  beforeEach(() => utils.resetTestDB());

  /**
   * Create user
   */

  beforeEach(() => models.User.create(userData).tap(u => user = u));

  it('should upload an image to S3', (done) => {
    request(app)
    .post(`/images/?api_key=${application.api_key}`)
    .attach('file', 'test/mocks/images/camera.png')
    .set('Authorization', `Bearer ${user.jwt()}`)
    .expect(200)
    .end((err, res) => {
      expect(res.body.url).to.contain('.png');
      done();
    });
  });

  it('should throw an error if no file field is sent', (done) => {
    request(app)
    .post(`/images/?api_key=${application.api_key}`)
    .set('Authorization', `Bearer ${user.jwt()}`)
    .expect(400)
    .end(done);
  });

  it('should upload if the user is not logged in', (done) => {
    request(app)
    .post(`/images/?api_key=${application.api_key}`)
    .attach('file', 'test/mocks/images/camera.png')
    .expect(200)
    .end(done);
  });
});
