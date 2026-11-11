import toast from "react-hot-toast";
import { getLanguage, translate } from "./language";
const localized = {
  success: (message: string) =>
    toast.success(translate(getLanguage(), message)),
  error: (message: string) =>
    toast.error(translate(getLanguage(), message, [], true)),
};
export default localized;
