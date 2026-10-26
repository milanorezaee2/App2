import { Redirect } from 'expo-router';
import { FEATURES } from '@/lib/features';

/**
 * ترکی هنوز کارگاه تلفظ مستقل ندارد؛ تب «تلفظ» به درس صداها و حروف ویژه
 * (`tr-l1-sounds`) می‌رود که همان تمرین آوایی را با جمله‌های واقعی دارد.
 */
export default function TurkishPronunciationRoute() {
  if (!FEATURES.turkishCourse) return <Redirect href={'/languages' as never} />;
  return <Redirect href={'/learn/tr/lesson?id=tr-l1-sounds' as never} />;
}
