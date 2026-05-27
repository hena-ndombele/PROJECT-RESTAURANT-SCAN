import { request } from '../../shared/api/httpClient';

export function getPublicMenu(params = {}) {
  return Promise.all([
    request('/category/list'),
    request('/plats/list'),
  ]).then(([categories, platsResponse]) => {
    const plats = Array.isArray(platsResponse) ? platsResponse : platsResponse.data ?? [];

    return {
      categories: categories.map((category) => ({
        ...category,
        plats_count: plats.filter((plat) => plat.category_id === category.id).length,
      })),
      plats,
    };
  });
}
