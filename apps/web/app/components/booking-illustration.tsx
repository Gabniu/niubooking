// Ownership: accessible wrapper for the approved Booking illustration catalog.
import { bookingIllustrations, illustrationSrc, type BookingIllustrationId } from "../lib/illustrations.js";

type BookingIllustrationProps = {
  id: BookingIllustrationId;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export function BookingIllustration({ id, alt, className = "booking-illustration", loading = "lazy" }: BookingIllustrationProps) {
  const illustration = bookingIllustrations[id];
  return <img className={className} src={illustrationSrc(id)} alt={alt ?? illustration.defaultAlt} loading={loading} decoding="async" />;
}
