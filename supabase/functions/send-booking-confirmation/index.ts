import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingEmailRequest {
  email: string;
  name: string;
  bookingId: string;
  movieTitle: string;
  theaterName: string;
  showDate: string;
  showtime: string;
  seats: string[];
  totalAmount: number;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("🎬 Edge function called - send-booking-confirmation");
  console.log("Request method:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📧 Parsing request body...");
    const requestBody = await req.json();
    console.log("📦 RAW REQUEST BODY:", JSON.stringify(requestBody, null, 2));
    
    const {
      email,
      name,
      bookingId,
      movieTitle,
      theaterName,
      showDate,
      showtime,
      seats,
      totalAmount,
    }: BookingEmailRequest = requestBody;

    console.log("📧 EXTRACTED EMAIL:", email);
    console.log("👤 EXTRACTED NAME:", name);

    // Validate required fields
    if (!email || !name) {
      console.error("❌ Missing required fields - email or name");
      return new Response(
        JSON.stringify({ 
          error: "Email and name are required",
          details: { email: !!email, name: !!name }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✉️ Sending booking confirmation email");
    console.log("📮 SENDING TO RECIPIENT:", email);
    console.log("👤 RECIPIENT NAME:", name);
    console.log("🎫 BOOKING ID:", bookingId);
    console.log("🎬 MOVIE:", movieTitle);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f5f5f5;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: bold;
            }
            .success-icon {
              width: 60px;
              height: 60px;
              background: white;
              border-radius: 50%;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 15px;
              font-size: 30px;
            }
            .content {
              padding: 30px;
            }
            .booking-id {
              background: #f9fafb;
              border-left: 4px solid #dc2626;
              padding: 15px;
              margin: 20px 0;
              font-family: monospace;
              font-size: 18px;
              font-weight: bold;
            }
            .movie-details {
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .movie-title {
              font-size: 24px;
              font-weight: bold;
              color: #991b1b;
              margin: 0 0 15px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              padding: 12px 0;
              border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: 600;
              color: #6b7280;
            }
            .detail-value {
              font-weight: bold;
              color: #111827;
              text-align: right;
            }
            .seats {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-top: 8px;
            }
            .seat-badge {
              background: #dc2626;
              color: white;
              padding: 6px 12px;
              border-radius: 6px;
              font-weight: bold;
              font-size: 14px;
            }
            .total-amount {
              background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
              color: white;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin: 20px 0;
            }
            .total-amount .amount {
              font-size: 36px;
              font-weight: bold;
              margin: 10px 0;
            }
            .important-note {
              background: #fef3c7;
              border: 2px solid #fbbf24;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
            }
            .important-note h3 {
              margin: 0 0 10px 0;
              color: #92400e;
            }
            .important-note ul {
              margin: 0;
              padding-left: 20px;
            }
            .important-note li {
              margin: 5px 0;
              color: #78350f;
            }
            .footer {
              background: #f9fafb;
              padding: 20px;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            .button {
              display: inline-block;
              background: #dc2626;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✓</div>
              <h1>🎬 Booking Confirmed!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your tickets are ready!</p>
            </div>
            
            <div class="content">
              <p>Dear ${name},</p>
              <p>Thank you for booking with us! Your movie tickets have been confirmed. Get ready for an amazing cinematic experience!</p>
              
              <div class="booking-id">
                Booking ID: ${bookingId}
              </div>
              
              <div class="movie-details">
                <h2 class="movie-title">🎥 ${movieTitle}</h2>
                
                <div class="detail-row">
                  <span class="detail-label">📍 Theater</span>
                  <span class="detail-value">${theaterName}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">📅 Date</span>
                  <span class="detail-value">${showDate}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">🕐 Showtime</span>
                  <span class="detail-value">${showtime}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">🎫 Seats</span>
                  <div class="detail-value">
                    <div class="seats">
                      ${seats.map(seat => `<span class="seat-badge">${seat}</span>`).join('')}
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="total-amount">
                <div style="font-size: 16px; opacity: 0.9;">Total Amount Paid</div>
                <div class="amount">₹${totalAmount}</div>
                <div style="font-size: 14px; opacity: 0.8;">Payment Successful ✓</div>
              </div>
              
              <div class="important-note">
                <h3>⚠️ Important Information</h3>
                <ul>
                  <li>Please arrive at least 15 minutes before showtime</li>
                  <li>Carry a valid ID proof for verification</li>
                  <li>Show this email or booking ID at the counter</li>
                  <li>Scan the QR code for contactless entry</li>
                  <li>Outside food and beverages are not allowed</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="margin-bottom: 15px;">Need to make changes?</p>
                <a href="#" class="button">Manage Booking</a>
              </div>
              
              <p style="margin-top: 30px;">Enjoy the show! 🍿</p>
              <p>If you have any questions, feel free to contact our support team.</p>
            </div>
            
            <div class="footer">
              <p><strong>MovieBooking</strong></p>
              <p>Your Ultimate Movie Booking Experience</p>
              <p style="margin-top: 10px; font-size: 12px;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "MovieBooking <onboarding@resend.dev>",
      to: [email],
      subject: `🎬 Booking Confirmed - ${movieTitle} | ${bookingId}`,
      html: emailHtml,
    });

    if (error) {
      console.error("Resend error:", error);
      throw error;
    }

    console.log("Email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-booking-confirmation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
