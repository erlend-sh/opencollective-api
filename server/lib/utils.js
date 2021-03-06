import Url from 'url';
import config from 'config';
import crypto from 'crypto';
import base64url from 'base64url';
import moment from 'moment';
import _ from 'lodash';

/**
 * Encrypt with resetPasswordSecret
 */
export const encrypt = (text) => {
  const cipher = crypto.createCipher('aes-256-cbc', config.keys.opencollective.resetPasswordSecret)
  let crypted = cipher.update(text, 'utf8', 'hex')
  crypted += cipher.final('hex');
  return crypted;
};

/**
 * Descript wih resetPasswordSecret
 */
export const decrypt = (text) => {
  const decipher = crypto.createDecipher('aes-256-cbc', config.keys.opencollective.resetPasswordSecret)
  let dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
};

/**
 * Generate a secured token that works inside URLs
 * http://stackoverflow.com/a/25690754
 */
export const generateURLSafeToken = size => base64url(crypto.randomBytes(size));

/**
 * Get current Url.
 */
export const getRequestedUrl = (req) => {
  return `${req.protocol}://${req.get('Host')}${req.url}`;
};

/**
 * Add parameters to an url.
 */
export const addParameterUrl = (url, parameters) => {
  const parsedUrl  = Url.parse(url, true);

  function removeTrailingChar(str, char) {
    if (str.substr(-1) === char) {
      return str.substr(0, str.length - 1);
    }

    return str;
  }

  parsedUrl.pathname = removeTrailingChar(parsedUrl.pathname, '/');

  delete parsedUrl.search; // Otherwise .search is used in place of .query
  delete parsedUrl.query.api_key; // make sure we don't surface the api_key publicly

  for (const p in parameters) {
    const param = parameters[p];
    parsedUrl.query[p] = param;
  }

  return Url.format(parsedUrl);
};

/**
 * Pagination: from (offset, limit) to (page, per_page).
 */
const paginatePage = (offset, limit) => {
  return {
    page: Math.floor(offset / limit + 1),
    perPage: limit
  }
};

/**
 * Get links for pagination.
 */
export const getLinks = (url, options) => {
  const page = options.page || paginatePage(options.offset, options.limit).page;
  const perPage = options.perPage || paginatePage(options.offset, options.limit).perPage;

  if (!page && !perPage)
    return null;

  const links = {
    next: addParameterUrl(url, {page: page + 1, per_page: perPage}),
    current: addParameterUrl(url, {page, per_page: perPage})
  };
  if (page > 1) {
    links.prev = addParameterUrl(url, {page: page - 1, per_page: perPage});
    links.first = addParameterUrl(url, {page: 1, per_page: perPage});
  }

  if (options.total) {
    const lastPage = Math.ceil(options.total / perPage);
    links.last = addParameterUrl(url, {page: lastPage, per_page: perPage});
    if (page >= lastPage)
      delete links.next;
  }

  return links;
};

/**
 * Get headers for pagination.
 */
export const getLinkHeader = (url, options) => {
  const links = getLinks(url, options);
  let header = '';
  let k = 0;
  for (const i in links) {
    header += ((k !== 0) ? ', ' : '') + '<' + links[i] + '>; rel="' + i + '"'; // eslint-disable-line
    k += 1;
  }

  return header;
};

/**
 * We can generate our own plan ids with stripe, we will use a simple one for
 * now until we decide to make more complex plans. We will only take into account
 * the currency, interval and amount. It will have the following format
 *
 * 'USD-MONTH-1000'
 */
export const planId = (plan) =>  {
  return [plan.currency, plan.interval, plan.amount].join('-').toUpperCase();
};

/**
 * Pagination offset: from (page,per_page) to (offset, limit).
 */
export const paginateOffset = (page, perPage) => {
  return {
    offset: (page - 1) * perPage,
    limit: perPage
  }
};

/**
 * Try to find in which tier a backer falls into based on the tiers definition
 */
export const getTier = (user, tiers) => {

  let defaultTier;
  switch (user.role) {
    case 'MEMBER':
      return 'core contributor';
    case 'HOST':
      defaultTier = 'host';
      break;
   default:
      defaultTier = 'backer';
      break;
  }

  if (!tiers || !user.totalDonations) return defaultTier;

  // we make a copy of tiers before we sort it
  tiers = _.clone(tiers);

  // We order the tiers by start range DESC
  tiers.sort((a,b) => {
    return b.range[0] - a.range[0];
  });

  // We get the first tier for which the totalDonations is higher than the minimum amount for that tier
  const tier = tiers.find((tier) => (user.totalDonations / 100 >= tier.range[0]));

  return (tier && tier.name) ? tier.name : defaultTier;

};

/**
 * Append tier to each backer in an array of backers
 */
export const appendTier = (backers, tiers) => {
  backers = backers.map((backer) => {
    backer.tier = getTier(backer, tiers);
    return backer;
  });
  return backers;
};

/**
 * Returns whether the backer is still an active member of its tier
 */
export const isBackerActive = (backer, tiers, until) => {
  tiers = _.groupBy(tiers, 'name'); // this makes a copy
  const now = moment(until);
  if (tiers[backer.tier] && tiers[backer.tier][0].interval === 'monthly' && now.diff(moment(backer.lastDonation), 'days') > 31)
    return false
  else
    return true;
}

/**
 * Default host id, set this for new groups created through Github
 */
export const defaultHostId = () => {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV  === 'staging') {
    return 772;
  }
  return 1;
};

/**
 * Demo host id, set this for new groups created through the flow
 */
export const demoHostId = () => {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV  === 'staging') {
    return 254;
  }
  return 1;
};

/**
 * Check if this is an internal email address.
 * Useful for testing emails in localhost or staging
 */
export const isEmailInternal = (email) => {
  if (!email) return false;
  if (email.toLowerCase().indexOf('@opencollective.com') !== -1 ||
    email.toLowerCase().indexOf('@opencollective.org') !== -1) {
    return true;
  }
  return false;
};

export function capitalize(str) {
  if (!str) return '';
  return str[0].toUpperCase() + str.slice(1);
}

export function pluralize(str, count) {
  if (count <= 1) return str;
  return `${str}s`.replace(/s+$/,'s');
}

export function resizeImage(imageUrl, { width, height, query }) {
  if (!imageUrl) return null;
  if (imageUrl[0] === '/') imageUrl = `https://opencollective.com${imageUrl}`;

  let queryurl = '';
  if (query) {
    queryurl = `&query=${encodeURIComponent(query)}`;
  } else {
    if (width) queryurl += `&width=${width}`;
    if (height) queryurl += `&height=${height}`;
  }
  return `${config.host.website}/proxy/images/?src=${encodeURIComponent(imageUrl)}${queryurl}`;
}

export function formatArrayToString(arr) {
  return arr.join(', ').replace(/, ([^,]*)$/,' and $1');
}

export function formatCurrency(amount, currency, precision = 0) {
  amount = amount/100; // converting cents

  return amount.toLocaleString(currency, {
    style: 'currency',
    currency,
    minimumFractionDigits : precision,
    maximumFractionDigits : precision
  });  
}

/**
 * @PRE: { USD: 1000, EUR: 6000 }
 * @POST: "$10 and €60"
 */
export function formatCurrencyObject(currencyObj, options = { precision: 0 }) {
  const array = [];
  for (const currency in currencyObj) {
    array.push(formatCurrency(currencyObj[currency], currency, options.precision));
  }
  return formatArrayToString(array);
}