import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const reservation = await prisma.reservations.findFirst({
    where: { guest_name: { contains: "Quoc Le" } }
  });
  console.log("Reservation for Quoc Le in DB:");
  console.log(JSON.stringify(reservation, null, 2));

  // Let's also find all reservations in the DB and their names
  const allRes = await prisma.reservations.findMany({
    select: {
      id: true,
      guest_name: true,
      check_in_date: true,
      check_out_date: true,
      status: true
    }
  });
  console.log("\nAll Reservations:");
  for (const r of allRes) {
    console.log(`  guest_name="${r.guest_name}" check_in="${r.check_in_date.toISOString()}" check_out="${r.check_out_date.toISOString()}"`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
  });
