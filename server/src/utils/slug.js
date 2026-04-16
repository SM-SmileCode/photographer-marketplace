
import slugify from "slugify";

export const makeBaseSlug = (businessName, city) => {
 return slugify(`${businessName}-${city}`, { lower: true, strict: true });
};

export const generateUniqueSlug = async (Model, baseSlug, excludeId = null) => {
  let slug = baseSlug;
  let count = 2;

  while (
    await Model.exists({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
  ) {
    slug = `${baseSlug}-${count}`;
    count += 1;
  }
  return slug;
};
