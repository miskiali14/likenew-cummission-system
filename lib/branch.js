// Branch isolation boundary: non-admins can never see/write outside their own
// branch, regardless of what a client sends in the query/body.
export const resolveBranch = (user, searchParams) => {
  if (user.role === 'ADMIN') {
    const branch = searchParams.get('branch');
    return branch && branch !== 'All' ? branch : undefined;
  }
  return user.branch;
};

export const ROLE_DEPARTMENT_MAP = {
  SALES: 'WASHING',
  QUALITY_CONTROL: 'IRONING',
};
