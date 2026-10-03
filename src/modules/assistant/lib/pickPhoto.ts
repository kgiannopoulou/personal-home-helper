import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { fitWithin, type Photo } from './photos';

/**
 * Takes or picks a photo, scaled down and compressed so it uploads fast and fits in the saved chat.
 * Null if cancelled; throws if the camera isn't allowed.
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<Photo | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is off. Allow it in your phone settings, or pick a photo instead.');
  }
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;

  let context = ImageManipulator.manipulate(asset.uri);
  const size = fitWithin(asset.width, asset.height);
  if (size) context = context.resize(size);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('Could not read the photo.');
  return { uri: saved.uri, base64: saved.base64, mediaType: 'image/jpeg' };
}
