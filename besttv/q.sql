select email, role, site, "isActive", left("passwordHash",7) as algo, length("passwordHash") as len
from "User" where role <> 'USER' order by "createdAt";
