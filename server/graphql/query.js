import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLString
} from 'graphql';

import {
  EventType
} from './types';

import models from '../models';

const queries = {
  /*
   * Given a collective slug and an event slug, returns the event
   */
  getEvent: {
    type: EventType,
    args: {
      eventSlug: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Event slug'
      },
      collectiveSlug: {
        type: new GraphQLNonNull(GraphQLString)
      }
    },
    resolve(_, args) {
      return models.Event.findOne({
        where: { slug: args.eventSlug },
        include: [{
          model: models.Group,
          where: { slug: args.collectiveSlug }
        }]
      })
    }
  },
  /*
   * Given a collective slug, returns the events
   */
  getEvents: {
    type: new GraphQLList(EventType),
    args: {
      collectiveSlug: {
        type: new GraphQLNonNull(GraphQLString)
      }
    },
    resolve(_, args) {
      return models.Event.findAll({
        include: [{
          model: models.Group,
          where: { slug: args.collectiveSlug }
        }]
      })
    }
  }
}

export default queries;