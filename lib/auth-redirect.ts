/** Accept only paths on this site, including their exam/session query. */
export function safeLoginDestination(value:string|null){
  if(!value||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020]/.test(value))return '/';
  return value;
}
