import { Router } from 'express';
import { getEnabledCountries, getCountry, DEFAULT_COUNTRY_CODE } from '../../../../shared/countries.js';

const router = Router();

/** GET /api/v1/locations/countries — supported countries (without region lists) */
router.get('/countries', (req, res) => {
  const countries = getEnabledCountries().map(({ regions, ...rest }) => ({
    ...rest,
    regionCount: regions.length,
  }));
  res.json({ defaultCountry: DEFAULT_COUNTRY_CODE, countries });
});

/** GET /api/v1/locations/countries/:code — one country with its states and districts */
router.get('/countries/:code', (req, res) => {
  const country = getCountry(req.params.code);
  if (!country || !country.enabled) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Country not supported.' });
  }
  res.json(country);
});

export default router;
